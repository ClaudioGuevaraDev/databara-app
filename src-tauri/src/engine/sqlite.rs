//! SQLite engine (rusqlite, statically bundled). rusqlite is synchronous and its
//! `Connection` is `!Sync`, so the handle is an `Arc<Mutex<Connection>>` and every
//! operation runs on a blocking thread via `spawn_blocking`. Because `session()`
//! already released the `AppState` lock, holding the inner mutex here is safe.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use rusqlite::types::ValueRef;
use rusqlite::Connection;

use super::types::{
    emit_backup_progress, parse_object_id, AppError, ColumnDefinition, ConnectionProfile,
    DatabaseObjectDetails, DatabaseObjectKind, DatabaseTreeNode, IndexDefinition, QueryExecution,
};

pub type SqliteHandle = Arc<Mutex<Connection>>;

pub struct SqliteConfig {
    pub file_path: String,
}

fn map_err(error: rusqlite::Error) -> AppError {
    AppError::Driver(format!("SQLite error: {error}"))
}

/// SQLite has no schemas; a synthetic `main` fills the schema slot of object ids so
/// `parse_object_id` keeps its `{kind}:{schema}.{name}` grammar.
const SCHEMA: &str = "main";

/// Quotes an identifier for interpolation into PRAGMA / COUNT statements (which
/// can't take bind parameters for the table name).
fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

fn file_base_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Runs `f` with a locked connection on a blocking thread.
async fn with_conn<T, F>(handle: &SqliteHandle, f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&Connection) -> Result<T, AppError> + Send + 'static,
{
    let handle = Arc::clone(handle);
    tauri::async_runtime::spawn_blocking(move || {
        let guard = handle.lock().map_err(|_| AppError::StateLock)?;
        f(&guard)
    })
    .await
    .map_err(|error| AppError::Driver(format!("SQLite task error: {error}")))?
}

pub async fn open(cfg: &SqliteConfig) -> Result<SqliteHandle, AppError> {
    let path = cfg.file_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = Connection::open(&path).map_err(map_err)?;
        Ok::<_, AppError>(Arc::new(Mutex::new(conn)))
    })
    .await
    .map_err(|error| AppError::Driver(format!("SQLite task error: {error}")))?
}

pub async fn version(handle: &SqliteHandle) -> Result<String, AppError> {
    with_conn(handle, |conn| {
        let version: String = conn
            .query_row("SELECT sqlite_version()", [], |row| row.get(0))
            .map_err(map_err)?;
        Ok(format!("SQLite {version}"))
    })
    .await
}

pub async fn list_tree(
    handle: &SqliteHandle,
    profile: &ConnectionProfile,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let file_path = profile.host.clone();
    with_conn(handle, move |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT name, type FROM sqlite_master \
                 WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' \
                 ORDER BY type, name",
            )
            .map_err(map_err)?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(map_err)?;

        let mut objects: Vec<DatabaseTreeNode> = Vec::new();
        for row in rows {
            let (name, kind) = row.map_err(map_err)?;
            let (id_kind, node_kind) = if kind == "view" {
                ("view", DatabaseObjectKind::View)
            } else {
                ("table", DatabaseObjectKind::Table)
            };
            objects.push(DatabaseTreeNode {
                id: format!("{id_kind}:{SCHEMA}.{name}"),
                label: name,
                kind: node_kind,
                open: None,
                children: None,
            });
        }

        let base = file_base_name(&file_path);
        Ok(vec![DatabaseTreeNode {
            // Server-node id mirrors `server:{host}:{port}`; the frontend rewrites it
            // to include the engine. For SQLite `host` carries the file path so each
            // file is a distinct server/connection.
            id: format!("server:{file_path}:0"),
            label: base.clone(),
            kind: DatabaseObjectKind::Database,
            open: Some(true),
            children: Some(vec![DatabaseTreeNode {
                id: format!("database:{base}"),
                label: base,
                kind: DatabaseObjectKind::Database,
                open: Some(true),
                children: Some(objects),
            }]),
        }])
    })
    .await
}

pub async fn object_details(
    handle: &SqliteHandle,
    object_id: &str,
) -> Result<DatabaseObjectDetails, AppError> {
    let object = parse_object_id(object_id)?;
    let object_id = object_id.to_string();
    with_conn(handle, move |conn| {
        let columns = load_columns(conn, &object.name)?;
        let indexes = load_indexes(conn, &object.name)?;
        let row_count = count_rows(conn, &object.name)?;
        let safe_edit = columns.iter().any(|column| column.primary_key);

        Ok(DatabaseObjectDetails {
            id: object_id,
            name: object.name,
            schema: object.schema,
            kind: object.kind,
            engine: super::EngineKind::Sqlite,
            row_count,
            safe_edit,
            columns,
            indexes,
        })
    })
    .await
}

fn load_columns(conn: &Connection, table: &str) -> Result<Vec<ColumnDefinition>, AppError> {
    // Columns that participate in any index, to fill `indexed`.
    let indexed = indexed_columns(conn, table)?;

    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", quote_ident(table)))
        .map_err(map_err)?;
    let rows = stmt
        .query_map([], |row| {
            // table_info: cid, name, type, notnull, dflt_value, pk
            let name: String = row.get(1)?;
            let data_type: String = row.get(2)?;
            let not_null: i64 = row.get(3)?;
            let pk: i64 = row.get(5)?;
            Ok((name, data_type, not_null, pk))
        })
        .map_err(map_err)?;

    let mut columns = Vec::new();
    for row in rows {
        let (name, data_type, not_null, pk) = row.map_err(map_err)?;
        let primary_key = pk > 0;
        columns.push(ColumnDefinition {
            indexed: primary_key || indexed.contains(&name),
            primary_key,
            nullable: not_null == 0,
            data_type: if data_type.is_empty() {
                "".to_string()
            } else {
                data_type
            },
            name,
        });
    }
    Ok(columns)
}

fn indexed_columns(conn: &Connection, table: &str) -> Result<Vec<String>, AppError> {
    let index_names = index_list(conn, table)?;
    let mut names = Vec::new();
    for (index_name, _unique, _primary) in index_names {
        for column in index_info(conn, &index_name)? {
            if !names.contains(&column) {
                names.push(column);
            }
        }
    }
    Ok(names)
}

/// Returns (index_name, unique, primary) for each index on `table`.
fn index_list(conn: &Connection, table: &str) -> Result<Vec<(String, bool, bool)>, AppError> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA index_list({})", quote_ident(table)))
        .map_err(map_err)?;
    let rows = stmt
        .query_map([], |row| {
            // index_list: seq, name, unique, origin, partial
            let name: String = row.get(1)?;
            let unique: i64 = row.get(2)?;
            let origin: String = row.get(3)?;
            Ok((name, unique == 1, origin == "pk"))
        })
        .map_err(map_err)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(map_err)?);
    }
    Ok(out)
}

fn index_info(conn: &Connection, index: &str) -> Result<Vec<String>, AppError> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA index_info({})", quote_ident(index)))
        .map_err(map_err)?;
    let rows = stmt
        .query_map([], |row| {
            // index_info: seqno, cid, name
            let name: Option<String> = row.get(2)?;
            Ok(name)
        })
        .map_err(map_err)?;
    let mut out = Vec::new();
    for row in rows {
        if let Some(name) = row.map_err(map_err)? {
            out.push(name);
        }
    }
    Ok(out)
}

fn load_indexes(conn: &Connection, table: &str) -> Result<Vec<IndexDefinition>, AppError> {
    let mut indexes = Vec::new();
    for (name, unique, primary) in index_list(conn, table)? {
        let columns = index_info(conn, &name)?;
        indexes.push(IndexDefinition {
            name,
            columns,
            unique,
            primary,
        });
    }
    Ok(indexes)
}

fn count_rows(conn: &Connection, table: &str) -> Result<i64, AppError> {
    conn.query_row(
        &format!("SELECT COUNT(*) FROM {}", quote_ident(table)),
        [],
        |row| row.get(0),
    )
    .map_err(map_err)
}

pub async fn run_query(handle: &SqliteHandle, sql: &str) -> Result<QueryExecution, AppError> {
    let sql = sql.to_string();
    with_conn(handle, move |conn| run_query_blocking(conn, &sql)).await
}

fn run_query_blocking(conn: &Connection, sql: &str) -> Result<QueryExecution, AppError> {
    let start = Instant::now();
    let mut stmt = conn.prepare(sql).map_err(map_err)?;
    let column_count = stmt.column_count();
    let columns: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect();

    let mut categories: Vec<&'static str> = vec!["string"; column_count];
    let mut category_set: Vec<bool> = vec![false; column_count];
    let mut rows: Vec<Vec<Option<String>>> = Vec::new();

    let mut query_rows = stmt.query([]).map_err(map_err)?;
    while let Some(row) = query_rows.next().map_err(map_err)? {
        let mut out = Vec::with_capacity(column_count);
        for index in 0..column_count {
            let value = row.get_ref(index).map_err(map_err)?;
            if !category_set[index] {
                if let Some(category) = category_of(value) {
                    categories[index] = category;
                    category_set[index] = true;
                }
            }
            out.push(value_to_string(value));
        }
        rows.push(out);
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
    let rows_affected = if is_dml { Some(conn.changes()) } else { None };

    Ok(QueryExecution {
        columns,
        column_types: categories.iter().map(|c| c.to_string()).collect(),
        row_count: rows.len(),
        rows,
        duration_ms,
        rows_affected,
        command_tag,
    })
}

fn category_of(value: ValueRef) -> Option<&'static str> {
    match value {
        ValueRef::Integer(_) | ValueRef::Real(_) => Some("number"),
        ValueRef::Text(_) | ValueRef::Blob(_) => Some("string"),
        ValueRef::Null => None,
    }
}

fn value_to_string(value: ValueRef) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Integer(int) => Some(int.to_string()),
        ValueRef::Real(real) => Some(real.to_string()),
        ValueRef::Text(bytes) => Some(String::from_utf8_lossy(bytes).into_owned()),
        ValueRef::Blob(bytes) => Some(format!("0x{}", to_hex(bytes))),
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

/// Renders a SQLite value as a SQL literal for a backup INSERT.
fn sql_literal(value: ValueRef) -> String {
    match value {
        ValueRef::Null => "NULL".to_string(),
        ValueRef::Integer(int) => int.to_string(),
        ValueRef::Real(real) => real.to_string(),
        ValueRef::Text(bytes) => {
            format!("'{}'", String::from_utf8_lossy(bytes).replace('\'', "''"))
        }
        ValueRef::Blob(bytes) => format!("X'{}'", to_hex(bytes)),
    }
}

pub async fn backup(
    handle: &SqliteHandle,
    app: &tauri::AppHandle,
    profile: &ConnectionProfile,
    directory: &str,
    file_name: &str,
) -> Result<String, AppError> {
    let app = app.clone();
    let base = file_base_name(&profile.host);
    let directory = directory.to_string();
    let file_name = file_name.to_string();
    let handle = Arc::clone(handle);

    tauri::async_runtime::spawn_blocking(move || {
        let conn = handle.lock().map_err(|_| AppError::StateLock)?;
        backup_blocking(&conn, &app, &base, &directory, &file_name)
    })
    .await
    .map_err(|error| AppError::Driver(format!("SQLite task error: {error}")))?
}

fn backup_blocking(
    conn: &Connection,
    app: &tauri::AppHandle,
    base: &str,
    directory: &str,
    file_name: &str,
) -> Result<String, AppError> {
    use std::io::Write;

    let mut file_name = file_name.trim().to_string();
    if file_name.is_empty() {
        file_name = format!("{base}_backup.sql");
    }
    if !file_name.to_ascii_lowercase().ends_with(".sql") {
        file_name.push_str(".sql");
    }
    let path = std::path::Path::new(directory).join(&file_name);
    let file = std::fs::File::create(&path).map_err(|e| AppError::Connection(e.to_string()))?;
    let mut writer = std::io::BufWriter::new(file);
    macro_rules! w {
        ($($arg:tt)*) => {
            write!(writer, $($arg)*).map_err(|e| AppError::Connection(e.to_string()))?
        };
    }

    emit_backup_progress(app, 0, "");
    w!("-- Databara backup of SQLite database \"{}\"\n", base);
    w!("PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n");

    // Table DDL + data first, then views and indexes (DDL text lives in sqlite_master).
    let tables: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT name, sql FROM sqlite_master \
                 WHERE type = 'table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' \
                 ORDER BY name",
            )
            .map_err(map_err)?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(map_err)?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(map_err)?);
        }
        out
    };

    let total = tables.len().max(1);
    for (index, (name, sql)) in tables.iter().enumerate() {
        let percent = (5 + (index * 90 / total)).min(95) as u8;
        emit_backup_progress(app, percent, name);

        w!("{};\n", sql);
        dump_table_rows(conn, &mut writer, name)?;
        w!("\n");
    }

    // Views and non-autoindex indexes.
    let mut stmt = conn
        .prepare(
            "SELECT type, sql FROM sqlite_master \
             WHERE type IN ('view', 'index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' \
             ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name",
        )
        .map_err(map_err)?;
    let rows = stmt
        .query_map([], |row| Ok(row.get::<_, String>(1)?))
        .map_err(map_err)?;
    for row in rows {
        let sql = row.map_err(map_err)?;
        w!("{};\n", sql);
    }

    w!("\nCOMMIT;\n");
    writer
        .flush()
        .map_err(|e| AppError::Connection(e.to_string()))?;
    emit_backup_progress(app, 100, "");

    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE users (
               id INTEGER PRIMARY KEY,
               name TEXT NOT NULL,
               email TEXT
             );
             CREATE UNIQUE INDEX idx_users_email ON users(email);
             INSERT INTO users (id, name, email) VALUES (1, 'Ada', 'ada@x.io');
             INSERT INTO users (id, name, email) VALUES (2, 'Linus', NULL);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn run_query_reads_rows_and_categories() {
        let conn = seed();
        let result =
            run_query_blocking(&conn, "SELECT id, name, email FROM users ORDER BY id").unwrap();

        assert_eq!(result.columns, vec!["id", "name", "email"]);
        assert_eq!(result.column_types, vec!["number", "string", "string"]);
        assert_eq!(result.row_count, 2);
        assert_eq!(
            result.rows[0],
            vec![
                Some("1".to_string()),
                Some("Ada".to_string()),
                Some("ada@x.io".to_string())
            ]
        );
        // NULL email round-trips as None.
        assert_eq!(result.rows[1][2], None);
    }

    #[test]
    fn run_query_reports_dml_rows_affected() {
        let conn = seed();
        let result =
            run_query_blocking(&conn, "UPDATE users SET name = 'Grace' WHERE id = 1").unwrap();
        assert_eq!(result.command_tag.as_deref(), Some("UPDATE"));
        assert_eq!(result.rows_affected, Some(1));
        assert_eq!(result.row_count, 0);
    }

    #[test]
    fn columns_report_nullability_and_keys() {
        let conn = seed();
        let columns = load_columns(&conn, "users").unwrap();
        assert_eq!(columns.len(), 3);

        let id = &columns[0];
        assert_eq!(id.name, "id");
        assert!(id.primary_key);
        assert!(id.indexed);

        let name = &columns[1];
        assert!(!name.nullable);
        assert!(!name.primary_key);

        let email = &columns[2];
        assert!(email.nullable);
        // email participates in the unique index.
        assert!(email.indexed);
    }

    #[test]
    fn indexes_include_user_defined_unique() {
        let conn = seed();
        let indexes = load_indexes(&conn, "users").unwrap();
        let email_index = indexes
            .iter()
            .find(|index| index.name == "idx_users_email")
            .expect("unique index should be listed");
        assert!(email_index.unique);
        assert!(!email_index.primary);
        assert_eq!(email_index.columns, vec!["email"]);
    }

    #[test]
    fn count_rows_is_exact() {
        let conn = seed();
        assert_eq!(count_rows(&conn, "users").unwrap(), 2);
    }

    fn test_profile(file_path: &str) -> ConnectionProfile {
        ConnectionProfile {
            id: "test".into(),
            name: "test".into(),
            engine: super::super::EngineKind::Sqlite,
            engine_version: String::new(),
            host: file_path.to_string(),
            port: 0,
            database: String::new(),
            user: String::new(),
            status: "connected",
            latency_ms: 0,
            default_schema: "main".into(),
            ssl_mode: super::super::SslModeDraft::Disable,
            file_path: Some(file_path.to_string()),
            trust_server_cert: None,
        }
    }

    // Exercises the full async bridge (spawn_blocking + inner mutex) against a real
    // on-disk file: open → run_query (DDL/DML) → version → list_tree → object_details.
    #[test]
    fn async_open_list_and_query_roundtrip() {
        let path = std::env::temp_dir().join(format!("databara_test_{}.db", std::process::id()));
        let path_str = path.to_string_lossy().to_string();
        let _ = std::fs::remove_file(&path);

        tauri::async_runtime::block_on(async {
            let handle = open(&SqliteConfig {
                file_path: path_str.clone(),
            })
            .await
            .unwrap();

            run_query(&handle, "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
                .await
                .unwrap();
            let inserted = run_query(&handle, "INSERT INTO t (id, v) VALUES (1, 'a')")
                .await
                .unwrap();
            assert_eq!(inserted.rows_affected, Some(1));

            let version = version(&handle).await.unwrap();
            assert!(version.starts_with("SQLite"));

            let profile = test_profile(&path_str);
            let tree = list_tree(&handle, &profile).await.unwrap();
            let server = &tree[0];
            assert!(server.id.starts_with("server:"));
            let database = &server.children.as_ref().unwrap()[0];
            let objects = database.children.as_ref().unwrap();
            assert!(objects.iter().any(|node| node.id == "table:main.t"));

            let details = object_details(&handle, "table:main.t").await.unwrap();
            assert_eq!(details.name, "t");
            assert_eq!(details.row_count, 1);
        });

        let _ = std::fs::remove_file(&path);
    }
}

fn dump_table_rows<W: std::io::Write>(
    conn: &Connection,
    writer: &mut W,
    table: &str,
) -> Result<(), AppError> {
    let mut stmt = conn
        .prepare(&format!("SELECT * FROM {}", quote_ident(table)))
        .map_err(map_err)?;
    let column_count = stmt.column_count();
    let column_list = stmt
        .column_names()
        .iter()
        .map(|name| quote_ident(name))
        .collect::<Vec<_>>()
        .join(", ");
    let quoted_table = quote_ident(table);

    let mut rows = stmt.query([]).map_err(map_err)?;
    while let Some(row) = rows.next().map_err(map_err)? {
        let mut values = Vec::with_capacity(column_count);
        for index in 0..column_count {
            values.push(sql_literal(row.get_ref(index).map_err(map_err)?));
        }
        writeln!(
            writer,
            "INSERT INTO {} ({}) VALUES ({});",
            quoted_table,
            column_list,
            values.join(", ")
        )
        .map_err(|e| AppError::Connection(e.to_string()))?;
    }
    Ok(())
}
