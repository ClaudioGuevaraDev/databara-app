//! SQL Server engine (tiberius over a tokio TCP stream via tokio-util's compat
//! shim). TDS is a binary protocol, so unlike the other engines there is no text
//! mode — each `ColumnData` variant is decoded to a string by hand. tiberius's
//! `Client` needs `&mut self` and isn't clonable, so the handle is an
//! `Arc<tokio::sync::Mutex<Client<..>>>`.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Instant;

use tiberius::{AuthMethod, Client, ColumnType, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

use super::types::{
    parse_object_id, AppError, ColumnDefinition, ConnectionProfile, DatabaseObjectDetails,
    DatabaseObjectKind, DatabaseTreeNode, IndexDefinition, QueryExecution, SslModeDraft,
};

type TargetStream = Compat<TcpStream>;
pub type MssqlHandle = Arc<Mutex<Client<TargetStream>>>;

pub struct MssqlConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
    pub ssl_mode: SslModeDraft,
    pub trust_server_cert: bool,
}

fn map_err<E: std::fmt::Display>(error: E) -> AppError {
    AppError::Driver(format!("SQL Server error: {error}"))
}

pub async fn open(cfg: &MssqlConfig) -> Result<MssqlHandle, AppError> {
    let mut config = Config::new();
    config.host(&cfg.host);
    config.port(cfg.port);
    config.database(&cfg.database);
    config.authentication(AuthMethod::sql_server(&cfg.user, &cfg.password));
    config.encryption(match cfg.ssl_mode {
        SslModeDraft::Disable => EncryptionLevel::Off,
        SslModeDraft::Prefer => EncryptionLevel::On,
        SslModeDraft::Require => EncryptionLevel::Required,
    });
    if cfg.trust_server_cert {
        config.trust_cert();
    }

    let tcp = TcpStream::connect(config.get_addr())
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;
    let _ = tcp.set_nodelay(true);

    let client = Client::connect(config, tcp.compat_write())
        .await
        .map_err(map_err)?;
    Ok(Arc::new(Mutex::new(client)))
}

pub async fn version(handle: &MssqlHandle) -> Result<String, AppError> {
    let rows = simple_rows(
        handle,
        "SELECT CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(128))",
    )
    .await?;
    let version = rows
        .first()
        .and_then(|row| row.try_get::<&str, usize>(0).ok().flatten())
        .unwrap_or_default()
        .to_string();
    Ok(format!("SQL Server {version}"))
}

pub async fn list_tree(
    handle: &MssqlHandle,
    profile: &ConnectionProfile,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let rows = simple_rows(
        handle,
        "SELECT s.name AS schema_name, t.name AS object_name, 'table' AS kind \
         FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id \
         UNION ALL \
         SELECT s.name AS schema_name, v.name AS object_name, 'view' AS kind \
         FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id \
         ORDER BY schema_name, kind, object_name",
    )
    .await?;

    let mut schemas: BTreeMap<String, Vec<DatabaseTreeNode>> = BTreeMap::new();
    for row in &rows {
        let schema_name = try_string(row, 0).unwrap_or_default();
        let object_name = try_string(row, 1).unwrap_or_default();
        let kind = try_string(row, 2).unwrap_or_default();
        let (id_kind, node_kind) = if kind == "view" {
            ("view", DatabaseObjectKind::View)
        } else {
            ("table", DatabaseObjectKind::Table)
        };
        schemas
            .entry(schema_name.clone())
            .or_default()
            .push(DatabaseTreeNode {
                id: format!("{id_kind}:{schema_name}.{object_name}"),
                label: object_name,
                kind: node_kind,
                open: None,
                children: None,
            });
    }

    let schema_nodes = schemas
        .into_iter()
        .map(|(schema_name, objects)| DatabaseTreeNode {
            id: format!("schema:{schema_name}"),
            label: schema_name,
            kind: DatabaseObjectKind::Schema,
            open: Some(true),
            children: Some(objects),
        })
        .collect::<Vec<_>>();

    let host = &profile.host;
    let port = profile.port;
    let database = &profile.database;
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
            children: Some(schema_nodes),
        }]),
    }])
}

pub async fn object_details(
    handle: &MssqlHandle,
    object_id: &str,
) -> Result<DatabaseObjectDetails, AppError> {
    let object = parse_object_id(object_id)?;
    let qualified = format!("{}.{}", object.schema, object.name);

    // Columns + nullability, with primary-key and indexed flags via correlated existence.
    let column_rows = query_rows(
        handle,
        "SELECT c.name AS column_name, ty.name AS type_name, c.is_nullable, \
           CASE WHEN EXISTS ( \
             SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i \
               ON i.object_id = ic.object_id AND i.index_id = ic.index_id \
             WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id AND i.is_primary_key = 1 \
           ) THEN 1 ELSE 0 END AS is_pk, \
           CASE WHEN EXISTS ( \
             SELECT 1 FROM sys.index_columns ic \
             WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id \
           ) THEN 1 ELSE 0 END AS is_indexed \
         FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id \
         WHERE c.object_id = OBJECT_ID(@P1) \
         ORDER BY c.column_id",
        &qualified,
    )
    .await?;
    let columns: Vec<ColumnDefinition> = column_rows
        .iter()
        .map(|row| ColumnDefinition {
            name: try_string(row, 0).unwrap_or_default(),
            data_type: try_string(row, 1).unwrap_or_default(),
            nullable: try_bool(row, 2).unwrap_or(false),
            primary_key: try_i64(row, 3).unwrap_or(0) != 0,
            indexed: try_i64(row, 4).unwrap_or(0) != 0,
        })
        .collect();

    // Indexes: grouped by name, columns in key order.
    let index_rows = query_rows(
        handle,
        "SELECT i.name AS index_name, i.is_unique, i.is_primary_key, c.name AS column_name \
         FROM sys.indexes i \
         JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id \
         JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id \
         WHERE i.object_id = OBJECT_ID(@P1) \
         ORDER BY i.name, ic.key_ordinal",
        &qualified,
    )
    .await?;
    let indexes = group_indexes(
        index_rows
            .iter()
            .map(|row| {
                (
                    try_string(row, 0).unwrap_or_default(),
                    try_bool(row, 1).unwrap_or(false),
                    try_bool(row, 2).unwrap_or(false),
                    try_string(row, 3),
                )
            })
            .collect(),
    );

    // Row-count estimate from partition stats (the reltuples analogue).
    let count_rows = query_rows(
        handle,
        "SELECT SUM(p.rows) FROM sys.partitions p \
         WHERE p.object_id = OBJECT_ID(@P1) AND p.index_id IN (0, 1)",
        &qualified,
    )
    .await?;
    let row_count = count_rows
        .first()
        .and_then(|row| try_i64(row, 0))
        .unwrap_or(0);

    let safe_edit = indexes.iter().any(|index| index.primary);

    Ok(DatabaseObjectDetails {
        id: object_id.to_string(),
        name: object.name,
        schema: object.schema,
        kind: object.kind,
        engine: super::EngineKind::Mssql,
        row_count,
        safe_edit,
        columns,
        indexes,
    })
}

fn group_indexes(rows: Vec<(String, bool, bool, Option<String>)>) -> Vec<IndexDefinition> {
    let mut indexes: Vec<IndexDefinition> = Vec::new();
    for (name, unique, primary, column) in rows {
        let column = column.unwrap_or_default();
        if let Some(existing) = indexes.iter_mut().find(|index| index.name == name) {
            if !column.is_empty() {
                existing.columns.push(column);
            }
        } else {
            indexes.push(IndexDefinition {
                unique,
                primary,
                columns: if column.is_empty() {
                    Vec::new()
                } else {
                    vec![column]
                },
                name,
            });
        }
    }
    indexes
}

pub async fn run_query(handle: &MssqlHandle, sql: &str) -> Result<QueryExecution, AppError> {
    let start = Instant::now();
    let rows = {
        let mut client = handle.lock().await;
        let stream = client
            .simple_query(sql.to_string())
            .await
            .map_err(map_err)?;
        stream.into_first_result().await.map_err(map_err)?
    };
    let duration_ms = start.elapsed().as_millis();

    let columns: Vec<String> = rows
        .first()
        .map(|row| row.columns().iter().map(|c| c.name().to_string()).collect())
        .unwrap_or_default();
    let categories: Vec<String> = rows
        .first()
        .map(|row| {
            row.columns()
                .iter()
                .map(|c| category(c.column_type()).to_string())
                .collect()
        })
        .unwrap_or_default();

    let column_count = columns.len();
    let mut converted: Vec<Vec<Option<String>>> = Vec::with_capacity(rows.len());
    for row in &rows {
        let mut out = Vec::with_capacity(column_count);
        for index in 0..column_count {
            out.push(cell_to_string(row, index));
        }
        converted.push(out);
    }

    let command_tag = sql
        .split_whitespace()
        .next()
        .map(|word| word.to_ascii_uppercase());

    Ok(QueryExecution {
        columns,
        column_types: categories,
        row_count: converted.len(),
        rows: converted,
        duration_ms,
        // tiberius' simple_query doesn't surface an affected-row count cleanly.
        rows_affected: None,
        command_tag,
    })
}

/// Runs a parameterless statement and returns its first result set.
async fn simple_rows(handle: &MssqlHandle, sql: &str) -> Result<Vec<tiberius::Row>, AppError> {
    let mut client = handle.lock().await;
    let stream = client
        .simple_query(sql.to_string())
        .await
        .map_err(map_err)?;
    stream.into_first_result().await.map_err(map_err)
}

/// Runs a statement with a single `@P1` string parameter and returns its first result set.
async fn query_rows(
    handle: &MssqlHandle,
    sql: &str,
    param: &str,
) -> Result<Vec<tiberius::Row>, AppError> {
    let mut client = handle.lock().await;
    let stream = client.query(sql, &[&param]).await.map_err(map_err)?;
    stream.into_first_result().await.map_err(map_err)
}

fn try_string(row: &tiberius::Row, index: usize) -> Option<String> {
    row.try_get::<&str, usize>(index)
        .ok()
        .flatten()
        .map(|s| s.to_string())
}

fn try_bool(row: &tiberius::Row, index: usize) -> Option<bool> {
    row.try_get::<bool, usize>(index).ok().flatten()
}

fn try_i64(row: &tiberius::Row, index: usize) -> Option<i64> {
    row.try_get::<i64, usize>(index).ok().flatten()
}

fn category(column_type: ColumnType) -> &'static str {
    use ColumnType::*;
    match column_type {
        Int1 | Int2 | Int4 | Int8 | Intn | Float4 | Float8 | Floatn | Decimaln | Numericn
        | Money | Money4 => "number",
        Bit | Bitn => "boolean",
        _ => "string",
    }
}

fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// Converts one TDS cell to a display string (NULL → None). tiberius requires the
/// exact Rust type per column for `try_get`, and `ColumnData` is invariant in its
/// lifetime (so calling `FromSql` on a borrow doesn't type-check). We therefore try
/// candidate types in order via `try_get`, which handles the lifetimes internally:
/// on a type mismatch it returns `Err` (we skip), on SQL NULL `Ok(None)` (we stop).
fn cell_to_string(row: &tiberius::Row, index: usize) -> Option<String> {
    macro_rules! attempt {
        ($ty:ty, $fmt:expr) => {
            if let Ok(cell) = row.try_get::<$ty, usize>(index) {
                return cell.map($fmt);
            }
        };
    }

    attempt!(&str, |value: &str| value.to_string());
    attempt!(i32, |value: i32| value.to_string());
    attempt!(i64, |value: i64| value.to_string());
    attempt!(i16, |value: i16| value.to_string());
    attempt!(u8, |value: u8| value.to_string());
    attempt!(bool, |value: bool| value.to_string());
    attempt!(rust_decimal::Decimal, |value: rust_decimal::Decimal| value
        .to_string());
    attempt!(f64, |value: f64| value.to_string());
    attempt!(f32, |value: f32| value.to_string());
    attempt!(uuid::Uuid, |value: uuid::Uuid| value.to_string());
    attempt!(chrono::NaiveDateTime, |value: chrono::NaiveDateTime| value
        .to_string());
    attempt!(chrono::DateTime<chrono::Utc>, |value: chrono::DateTime<
        chrono::Utc,
    >| value.to_string());
    attempt!(chrono::NaiveDate, |value: chrono::NaiveDate| value
        .to_string());
    attempt!(chrono::NaiveTime, |value: chrono::NaiveTime| value
        .to_string());
    attempt!(&[u8], |value: &[u8]| format!("0x{}", to_hex(value)));

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_hex_encodes_bytes() {
        assert_eq!(to_hex(&[0xab, 0x01, 0xff]), "ab01ff");
    }

    #[test]
    fn category_maps_numeric_bit_and_default() {
        assert_eq!(category(ColumnType::Int4), "number");
        assert_eq!(category(ColumnType::Numericn), "number");
        assert_eq!(category(ColumnType::Bit), "boolean");
        assert_eq!(category(ColumnType::NVarchar), "string");
    }

    #[test]
    fn group_indexes_merges_columns() {
        let rows = vec![
            ("PK_t".to_string(), true, true, Some("id".to_string())),
            ("IX_ab".to_string(), false, false, Some("a".to_string())),
            ("IX_ab".to_string(), false, false, Some("b".to_string())),
        ];
        let indexes = group_indexes(rows);
        assert_eq!(indexes.len(), 2);
        let pk = indexes.iter().find(|i| i.name == "PK_t").unwrap();
        assert!(pk.primary && pk.unique);
        let ix = indexes.iter().find(|i| i.name == "IX_ab").unwrap();
        assert_eq!(ix.columns, vec!["a", "b"]);
    }
}
