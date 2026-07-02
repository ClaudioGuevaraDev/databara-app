//! MySQL / MariaDB engine (mysql_async). Both speak the MySQL wire protocol, so
//! one module serves both; the only difference is the `EngineKind` reported back.
//! Values are read over the text protocol and rendered to strings, mirroring the
//! PostgreSQL "everything as canonical text" approach.

use std::time::Instant;

use mysql_async::consts::ColumnType;
use mysql_async::prelude::*;
use mysql_async::{Opts, OptsBuilder, Pool, Row, SslOpts, Value};

use super::types::{
    parse_object_id, AppError, ColumnDefinition, ConnectionProfile, DatabaseObjectDetails,
    DatabaseObjectKind, DatabaseTreeNode, IndexDefinition, QueryExecution, SslModeDraft,
};
use super::EngineKind;

/// A MySQL/MariaDB pool plus which engine it represents (for the reported label).
#[derive(Clone)]
pub struct MySqlHandle {
    pub pool: Pool,
    pub engine: EngineKind,
}

pub struct MysqlConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
    pub ssl_mode: SslModeDraft,
}

fn map_err<E: std::fmt::Display>(error: E) -> AppError {
    AppError::Driver(format!("MySQL error: {error}"))
}

pub fn open(cfg: &MysqlConfig, engine: EngineKind) -> MySqlHandle {
    // MySQL has no true "prefer": Disable/Prefer connect in plaintext (so local
    // servers without TLS just work); Require negotiates TLS.
    let ssl_opts = match cfg.ssl_mode {
        SslModeDraft::Require => Some(SslOpts::default()),
        SslModeDraft::Prefer | SslModeDraft::Disable => None,
    };

    let opts: Opts = OptsBuilder::default()
        .ip_or_hostname(cfg.host.clone())
        .tcp_port(cfg.port)
        .user(Some(cfg.user.clone()))
        .pass(Some(cfg.password.clone()))
        .db_name(Some(cfg.database.clone()))
        .ssl_opts(ssl_opts)
        .into();

    MySqlHandle {
        pool: Pool::new(opts),
        engine,
    }
}

pub async fn version(handle: &MySqlHandle) -> Result<String, AppError> {
    let mut conn = handle.pool.get_conn().await.map_err(map_err)?;
    let version: Option<String> = conn
        .query_first("SELECT VERSION()")
        .await
        .map_err(map_err)?;
    Ok(format!(
        "{} {}",
        handle.engine.label(),
        version.unwrap_or_default()
    ))
}

pub async fn list_tree(
    handle: &MySqlHandle,
    profile: &ConnectionProfile,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let mut conn = handle.pool.get_conn().await.map_err(map_err)?;
    let database = &profile.database;
    let rows: Vec<(String, String)> = conn
        .query(
            "SELECT table_name, table_type FROM information_schema.tables \
             WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW') \
             ORDER BY table_type, table_name",
        )
        .await
        .map_err(map_err)?;

    let mut objects = Vec::new();
    for (name, table_type) in rows {
        let (id_kind, kind) = if table_type.eq_ignore_ascii_case("VIEW") {
            ("view", DatabaseObjectKind::View)
        } else {
            ("table", DatabaseObjectKind::Table)
        };
        objects.push(DatabaseTreeNode {
            // MySQL has no schema layer; the database name fills the schema slot.
            id: format!("{id_kind}:{database}.{name}"),
            label: name,
            kind,
            open: None,
            children: None,
        });
    }

    let host = &profile.host;
    let port = profile.port;
    Ok(vec![DatabaseTreeNode {
        id: format!("server:{host}:{port}"),
        label: format!("{host}:{port}"),
        kind: DatabaseObjectKind::Database,
        open: Some(true),
        children: Some(vec![DatabaseTreeNode {
            id: format!("database:{database}"),
            label: database.clone(),
            kind: DatabaseObjectKind::Database,
            open: Some(true),
            children: Some(objects),
        }]),
    }])
}

pub async fn object_details(
    handle: &MySqlHandle,
    object_id: &str,
) -> Result<DatabaseObjectDetails, AppError> {
    let object = parse_object_id(object_id)?;
    let mut conn = handle.pool.get_conn().await.map_err(map_err)?;

    // Columns: column_name, column_type, is_nullable, column_key.
    let column_rows: Vec<(String, String, String, String)> = conn
        .exec(
            "SELECT column_name, column_type, is_nullable, column_key \
             FROM information_schema.columns \
             WHERE table_schema = ? AND table_name = ? \
             ORDER BY ordinal_position",
            (object.schema.clone(), object.name.clone()),
        )
        .await
        .map_err(map_err)?;
    let columns: Vec<ColumnDefinition> = column_rows
        .into_iter()
        .map(
            |(name, data_type, is_nullable, column_key)| ColumnDefinition {
                name,
                data_type,
                nullable: is_nullable.eq_ignore_ascii_case("YES"),
                primary_key: column_key == "PRI",
                indexed: !column_key.is_empty(),
            },
        )
        .collect();

    // Indexes: grouped by index_name, ordered by seq_in_index.
    let index_rows: Vec<(String, i64, Option<String>)> = conn
        .exec(
            "SELECT index_name, non_unique, column_name \
             FROM information_schema.statistics \
             WHERE table_schema = ? AND table_name = ? \
             ORDER BY index_name, seq_in_index",
            (object.schema.clone(), object.name.clone()),
        )
        .await
        .map_err(map_err)?;
    let indexes = group_indexes(index_rows);

    // Row-count estimate (approximate for InnoDB, like pg reltuples).
    let row_count: Option<i64> = conn
        .exec_first(
            "SELECT table_rows FROM information_schema.tables \
             WHERE table_schema = ? AND table_name = ?",
            (object.schema.clone(), object.name.clone()),
        )
        .await
        .map_err(map_err)?;

    let safe_edit = indexes.iter().any(|index| index.primary);

    Ok(DatabaseObjectDetails {
        id: object_id.to_string(),
        name: object.name,
        schema: object.schema,
        kind: object.kind,
        engine: handle.engine,
        row_count: row_count.unwrap_or(0),
        safe_edit,
        columns,
        indexes,
    })
}

fn group_indexes(rows: Vec<(String, i64, Option<String>)>) -> Vec<IndexDefinition> {
    let mut indexes: Vec<IndexDefinition> = Vec::new();
    for (index_name, non_unique, column_name) in rows {
        let column = column_name.unwrap_or_default();
        if let Some(existing) = indexes.iter_mut().find(|index| index.name == index_name) {
            if !column.is_empty() {
                existing.columns.push(column);
            }
        } else {
            indexes.push(IndexDefinition {
                primary: index_name == "PRIMARY",
                unique: non_unique == 0,
                columns: if column.is_empty() {
                    Vec::new()
                } else {
                    vec![column]
                },
                name: index_name,
            });
        }
    }
    indexes
}

pub async fn run_query(handle: &MySqlHandle, sql: &str) -> Result<QueryExecution, AppError> {
    let mut conn = handle.pool.get_conn().await.map_err(map_err)?;
    let start = Instant::now();
    let mut result = conn.query_iter(sql.to_string()).await.map_err(map_err)?;

    let columns_meta = result.columns();
    let columns: Vec<String> = columns_meta
        .as_ref()
        .map(|cols| cols.iter().map(|c| c.name_str().to_string()).collect())
        .unwrap_or_default();
    let categories: Vec<String> = columns_meta
        .as_ref()
        .map(|cols| {
            cols.iter()
                .map(|c| category(c.column_type()).to_string())
                .collect()
        })
        .unwrap_or_default();

    let rows: Vec<Row> = result.collect::<Row>().await.map_err(map_err)?;
    let affected = result.affected_rows();

    let column_count = columns.len();
    let mut converted: Vec<Vec<Option<String>>> = Vec::with_capacity(rows.len());
    for mut row in rows {
        let mut out = Vec::with_capacity(column_count);
        for index in 0..column_count {
            let value = row.take::<Value, usize>(index).unwrap_or(Value::NULL);
            out.push(value_to_string(&value));
        }
        converted.push(out);
    }
    let duration_ms = start.elapsed().as_millis();

    let command_tag = sql
        .split_whitespace()
        .next()
        .map(|word| word.to_ascii_uppercase());
    let is_dml = matches!(
        command_tag.as_deref(),
        Some("INSERT") | Some("UPDATE") | Some("DELETE") | Some("REPLACE")
    );

    Ok(QueryExecution {
        columns,
        column_types: categories,
        row_count: converted.len(),
        rows: converted,
        duration_ms,
        rows_affected: if is_dml { Some(affected) } else { None },
        command_tag,
    })
}

fn category(column_type: ColumnType) -> &'static str {
    use ColumnType::*;
    match column_type {
        MYSQL_TYPE_TINY
        | MYSQL_TYPE_SHORT
        | MYSQL_TYPE_LONG
        | MYSQL_TYPE_LONGLONG
        | MYSQL_TYPE_INT24
        | MYSQL_TYPE_FLOAT
        | MYSQL_TYPE_DOUBLE
        | MYSQL_TYPE_DECIMAL
        | MYSQL_TYPE_NEWDECIMAL
        | MYSQL_TYPE_YEAR => "number",
        MYSQL_TYPE_JSON => "json",
        _ => "string",
    }
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::NULL => None,
        Value::Bytes(bytes) => Some(String::from_utf8_lossy(bytes).into_owned()),
        Value::Int(int) => Some(int.to_string()),
        Value::UInt(uint) => Some(uint.to_string()),
        Value::Float(float) => Some(float.to_string()),
        Value::Double(double) => Some(double.to_string()),
        Value::Date(year, month, day, hour, minutes, seconds, micros) => {
            if *hour == 0 && *minutes == 0 && *seconds == 0 && *micros == 0 {
                Some(format!("{year:04}-{month:02}-{day:02}"))
            } else if *micros == 0 {
                Some(format!(
                    "{year:04}-{month:02}-{day:02} {hour:02}:{minutes:02}:{seconds:02}"
                ))
            } else {
                Some(format!(
                    "{year:04}-{month:02}-{day:02} {hour:02}:{minutes:02}:{seconds:02}.{micros:06}"
                ))
            }
        }
        Value::Time(negative, days, hours, minutes, seconds, micros) => {
            let sign = if *negative { "-" } else { "" };
            let total_hours = *days * 24 + *hours as u32;
            if *micros == 0 {
                Some(format!("{sign}{total_hours:02}:{minutes:02}:{seconds:02}"))
            } else {
                Some(format!(
                    "{sign}{total_hours:02}:{minutes:02}:{seconds:02}.{micros:06}"
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_to_string_covers_common_variants() {
        assert_eq!(value_to_string(&Value::NULL), None);
        assert_eq!(
            value_to_string(&Value::Bytes(b"hello".to_vec())),
            Some("hello".to_string())
        );
        assert_eq!(value_to_string(&Value::Int(-7)), Some("-7".to_string()));
        assert_eq!(value_to_string(&Value::UInt(42)), Some("42".to_string()));
        assert_eq!(
            value_to_string(&Value::Date(2026, 7, 2, 0, 0, 0, 0)),
            Some("2026-07-02".to_string())
        );
        assert_eq!(
            value_to_string(&Value::Date(2026, 7, 2, 13, 5, 9, 0)),
            Some("2026-07-02 13:05:09".to_string())
        );
        assert_eq!(
            value_to_string(&Value::Time(false, 0, 1, 2, 3, 0)),
            Some("01:02:03".to_string())
        );
    }

    #[test]
    fn group_indexes_merges_multi_column_and_flags() {
        let rows = vec![
            ("PRIMARY".to_string(), 0, Some("id".to_string())),
            ("idx_ab".to_string(), 1, Some("a".to_string())),
            ("idx_ab".to_string(), 1, Some("b".to_string())),
        ];
        let indexes = group_indexes(rows);
        assert_eq!(indexes.len(), 2);

        let primary = indexes.iter().find(|i| i.name == "PRIMARY").unwrap();
        assert!(primary.primary);
        assert!(primary.unique);
        assert_eq!(primary.columns, vec!["id"]);

        let composite = indexes.iter().find(|i| i.name == "idx_ab").unwrap();
        assert!(!composite.primary);
        assert!(!composite.unique);
        assert_eq!(composite.columns, vec!["a", "b"]);
    }

    #[test]
    fn category_maps_numeric_and_json() {
        assert_eq!(category(ColumnType::MYSQL_TYPE_LONG), "number");
        assert_eq!(category(ColumnType::MYSQL_TYPE_NEWDECIMAL), "number");
        assert_eq!(category(ColumnType::MYSQL_TYPE_JSON), "json");
        assert_eq!(category(ColumnType::MYSQL_TYPE_VARCHAR), "string");
    }
}
