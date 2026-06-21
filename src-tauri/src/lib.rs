use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use futures_util::{pin_mut, TryStreamExt};
use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use thiserror::Error;
use tokio::time::timeout;
use tokio_postgres::{
    config::SslMode,
    types::{ToSql, Type},
    Client, Config, NoTls, Row,
};

#[derive(Default)]
struct AppState {
    sessions: HashMap<String, PostgresSession>,
    has_unsaved_sql_tabs: bool,
    allow_next_close: bool,
}

struct PostgresSession {
    profile: ConnectionProfile,
    client: Arc<Client>,
}

#[derive(Debug, Error)]
enum AppError {
    #[error("Connection failed: {0}")]
    Connection(String),
    #[error("Connection not found")]
    ConnectionNotFound,
    #[error("Invalid object id")]
    InvalidObjectId,
    #[error("{0}")]
    Postgres(String),
    #[error("TLS error: {0}")]
    Tls(#[from] native_tls::Error),
    #[error("Operation timed out")]
    Timeout,
    #[error("Internal state lock failed")]
    StateLock,
    #[error("Main window not found")]
    MainWindowNotFound,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<tokio_postgres::Error> for AppError {
    fn from(error: tokio_postgres::Error) -> Self {
        AppError::Postgres(format_postgres_error(&error))
    }
}

/// `tokio_postgres::Error`'s `Display` is just a generic "db error"; the useful
/// message (and optional detail/hint) lives in the underlying `DbError`.
fn format_postgres_error(error: &tokio_postgres::Error) -> String {
    let Some(db) = error.as_db_error() else {
        return format!("PostgreSQL error: {error}");
    };

    let mut message = format!("PostgreSQL error: {}", db.message());
    if let Some(detail) = db.detail() {
        message.push_str(&format!("\nDetail: {detail}"));
    }
    if let Some(hint) = db.hint() {
        message.push_str(&format!("\nHint: {hint}"));
    }
    message
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionDraft {
    name: String,
    host: String,
    port: u16,
    database: String,
    user: String,
    password: String,
    ssl_mode: SslModeDraft,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
enum SslModeDraft {
    Prefer,
    Require,
    Disable,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionProfile {
    id: String,
    name: String,
    engine: &'static str,
    engine_version: String,
    host: String,
    port: u16,
    database: String,
    user: String,
    status: &'static str,
    latency_ms: u128,
    default_schema: String,
    ssl_mode: SslModeDraft,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectResult {
    connection: ConnectionProfile,
    tree: Vec<DatabaseTreeNode>,
    selected_object_id: Option<String>,
    selected_object: Option<DatabaseObjectDetails>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionTestResult {
    ok: bool,
    latency_ms: u128,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseTreeNode {
    id: String,
    label: String,
    kind: DatabaseObjectKind,
    open: Option<bool>,
    children: Option<Vec<DatabaseTreeNode>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
enum DatabaseObjectKind {
    Database,
    Schema,
    Table,
    View,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseObjectDetails {
    id: String,
    name: String,
    schema: String,
    kind: DatabaseObjectKind,
    engine: &'static str,
    row_count: i64,
    safe_edit: bool,
    columns: Vec<ColumnDefinition>,
    indexes: Vec<IndexDefinition>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ColumnDefinition {
    name: String,
    data_type: String,
    nullable: bool,
    primary_key: bool,
    indexed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexDefinition {
    name: String,
    columns: Vec<String>,
    unique: bool,
    primary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryExecution {
    columns: Vec<String>,
    rows: Vec<Vec<Option<String>>>,
    row_count: usize,
    duration_ms: u128,
    rows_affected: Option<u64>,
    command_tag: Option<String>,
}

#[derive(Clone)]
struct CatalogObject {
    schema: String,
    name: String,
    kind: DatabaseObjectKind,
}

#[tauri::command]
async fn test_postgres_connection(
    draft: ConnectionDraft,
) -> Result<ConnectionTestResult, AppError> {
    let started = Instant::now();
    let (client, _) = open_postgres_connection(&draft).await?;
    let version = postgres_version(&client).await?;

    Ok(ConnectionTestResult {
        ok: true,
        latency_ms: started.elapsed().as_millis(),
        message: format!("Connection successful. {version}."),
    })
}

#[tauri::command]
async fn connect_postgres(
    state: State<'_, Mutex<AppState>>,
    draft: ConnectionDraft,
) -> Result<ConnectResult, AppError> {
    let started = Instant::now();
    let (client, version) = open_postgres_connection(&draft).await?;
    let tree = list_tree_for_client(&client, &draft.host, draft.port, &draft.database).await?;
    let connection_id = connection_id(&draft);
    let profile = ConnectionProfile {
        id: connection_id.clone(),
        name: draft.name,
        engine: "PostgreSQL",
        engine_version: version,
        host: draft.host,
        port: draft.port,
        database: draft.database,
        user: draft.user,
        status: "connected",
        latency_ms: started.elapsed().as_millis(),
        default_schema: "public".to_string(),
        ssl_mode: draft.ssl_mode,
    };

    let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
    guard.sessions.insert(
        connection_id,
        PostgresSession {
            profile: profile.clone(),
            client: Arc::new(client),
        },
    );

    Ok(ConnectResult {
        connection: profile,
        tree,
        selected_object_id: None,
        selected_object: None,
    })
}

#[tauri::command]
async fn list_postgres_tree(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let (client, profile) = session(&state, &connection_id)?;
    list_tree_for_client(&client, &profile.host, profile.port, &profile.database).await
}

#[tauri::command]
async fn get_postgres_object_details(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
    object_id: String,
) -> Result<DatabaseObjectDetails, AppError> {
    let (client, _) = session(&state, &connection_id)?;
    load_object_details(&client, &object_id).await
}

#[tauri::command]
async fn run_postgres_query(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
    sql: String,
) -> Result<QueryExecution, AppError> {
    let (client, _) = session(&state, &connection_id)?;

    // Prepare first so we can read column metadata even when the result is empty.
    let statement = client.prepare(&sql).await?;
    let columns: Vec<String> = statement
        .columns()
        .iter()
        .map(|column| column.name().to_string())
        .collect();

    // query_raw exposes the command tag and affected-row count once the stream is
    // exhausted, which `query` does not — needed to report DML/DDL results.
    let params: Vec<&(dyn ToSql + Sync)> = Vec::new();
    let start = Instant::now();
    let stream = client.query_raw(&statement, params).await?;
    pin_mut!(stream);

    let mut converted: Vec<Vec<Option<String>>> = Vec::new();
    while let Some(row) = stream.try_next().await? {
        converted.push((0..row.len()).map(|index| cell_to_string(&row, index)).collect());
    }

    let duration_ms = start.elapsed().as_millis();
    let rows_affected = stream.rows_affected();
    // tokio-postgres 0.7 doesn't expose the command tag here, so derive the verb
    // from the SQL itself (e.g. "DELETE", "INSERT", "CREATE").
    let command_tag = sql
        .split_whitespace()
        .next()
        .map(|word| word.to_ascii_uppercase());

    Ok(QueryExecution {
        columns,
        row_count: converted.len(),
        rows: converted,
        duration_ms,
        rows_affected,
        command_tag,
    })
}

/// Converts a single result cell into a displayable string, returning `None` for
/// SQL NULL. Covers the common PostgreSQL types; anything unrecognized falls back
/// to a best-effort text read so the conversion never panics.
fn cell_to_string(row: &Row, index: usize) -> Option<String> {
    let column_type = row.columns()[index].type_();

    match *column_type {
        Type::BOOL => row.get::<_, Option<bool>>(index).map(|value| value.to_string()),
        Type::INT2 => row.get::<_, Option<i16>>(index).map(|value| value.to_string()),
        Type::INT4 => row.get::<_, Option<i32>>(index).map(|value| value.to_string()),
        Type::INT8 => row.get::<_, Option<i64>>(index).map(|value| value.to_string()),
        Type::FLOAT4 => row.get::<_, Option<f32>>(index).map(|value| value.to_string()),
        Type::FLOAT8 => row.get::<_, Option<f64>>(index).map(|value| value.to_string()),
        Type::NUMERIC => row
            .get::<_, Option<rust_decimal::Decimal>>(index)
            .map(|value| value.to_string()),
        Type::TEXT | Type::VARCHAR | Type::BPCHAR | Type::CHAR | Type::NAME | Type::UNKNOWN => {
            row.get::<_, Option<String>>(index)
        }
        Type::UUID => row
            .get::<_, Option<uuid::Uuid>>(index)
            .map(|value| value.to_string()),
        Type::TIMESTAMP => row
            .get::<_, Option<chrono::NaiveDateTime>>(index)
            .map(|value| value.to_string()),
        Type::TIMESTAMPTZ => row
            .get::<_, Option<chrono::DateTime<chrono::Utc>>>(index)
            .map(|value| value.to_string()),
        Type::DATE => row
            .get::<_, Option<chrono::NaiveDate>>(index)
            .map(|value| value.to_string()),
        Type::TIME => row
            .get::<_, Option<chrono::NaiveTime>>(index)
            .map(|value| value.to_string()),
        Type::JSON | Type::JSONB => row
            .get::<_, Option<serde_json::Value>>(index)
            .map(|value| value.to_string()),
        _ => match row.try_get::<_, Option<String>>(index) {
            Ok(value) => value,
            Err(_) => Some(format!("<unsupported: {}>", column_type.name())),
        },
    }
}

#[tauri::command]
fn set_unsaved_sql_tabs(
    state: State<'_, Mutex<AppState>>,
    has_unsaved: bool,
) -> Result<(), AppError> {
    let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
    guard.has_unsaved_sql_tabs = has_unsaved;
    Ok(())
}

#[tauri::command]
fn close_main_window_after_unsaved_resolution(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    {
        let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
        guard.has_unsaved_sql_tabs = false;
        guard.allow_next_close = true;
    }

    let window = app
        .get_webview_window("main")
        .ok_or(AppError::MainWindowNotFound)?;
    window
        .close()
        .map_err(|error| AppError::Connection(error.to_string()))
}

/// Whether this installation can apply an in-app update.
/// On Linux the updater can only replace an AppImage (which sets the `APPIMAGE`
/// env var); `.deb`/`.rpm` installs live in root-owned system paths and can't be
/// updated in place. macOS and Windows always support it.
#[tauri::command]
fn updates_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("APPIMAGE").is_some()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

fn session(
    state: &State<'_, Mutex<AppState>>,
    connection_id: &str,
) -> Result<(Arc<Client>, ConnectionProfile), AppError> {
    let guard = state.lock().map_err(|_| AppError::StateLock)?;
    let session = guard
        .sessions
        .get(connection_id)
        .ok_or(AppError::ConnectionNotFound)?;
    Ok((Arc::clone(&session.client), session.profile.clone()))
}

async fn open_postgres_connection(draft: &ConnectionDraft) -> Result<(Client, String), AppError> {
    let mut config = Config::new();
    config
        .host(&draft.host)
        .port(draft.port)
        .dbname(&draft.database)
        .user(&draft.user)
        .password(&draft.password)
        .connect_timeout(Duration::from_secs(8));

    let client = match draft.ssl_mode {
        SslModeDraft::Disable => connect_without_tls(config).await?,
        SslModeDraft::Prefer => connect_with_tls(config, SslMode::Prefer).await?,
        SslModeDraft::Require => connect_with_tls(config, SslMode::Require).await?,
    };
    let version = postgres_version(&client).await?;

    Ok((client, version))
}

async fn connect_without_tls(mut config: Config) -> Result<Client, AppError> {
    config.ssl_mode(SslMode::Disable);
    let (client, connection) = timeout(Duration::from_secs(10), config.connect(NoTls))
        .await
        .map_err(|_| AppError::Timeout)?
        .map_err(|error| AppError::Connection(error.to_string()))?;

    tauri::async_runtime::spawn(async move {
        if let Err(error) = connection.await {
            eprintln!("PostgreSQL connection task ended: {error}");
        }
    });

    Ok(client)
}

async fn connect_with_tls(mut config: Config, ssl_mode: SslMode) -> Result<Client, AppError> {
    config.ssl_mode(ssl_mode);
    let connector = native_tls::TlsConnector::builder().build()?;
    let connector = MakeTlsConnector::new(connector);
    let (client, connection) = timeout(Duration::from_secs(10), config.connect(connector))
        .await
        .map_err(|_| AppError::Timeout)?
        .map_err(|error| AppError::Connection(error.to_string()))?;

    tauri::async_runtime::spawn(async move {
        if let Err(error) = connection.await {
            eprintln!("PostgreSQL TLS connection task ended: {error}");
        }
    });

    Ok(client)
}

async fn postgres_version(client: &Client) -> Result<String, AppError> {
    let row = client
        .query_one("select current_setting('server_version')", &[])
        .await?;
    Ok(row.get::<_, String>(0))
}

async fn list_tree_for_client(
    client: &Client,
    host: &str,
    port: u16,
    database_name: &str,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let rows = client
        .query(
            "
            select
              n.nspname as schema_name,
              c.relname as object_name,
              case when c.relkind in ('v', 'm') then 'view' else 'table' end as object_kind
            from pg_catalog.pg_class c
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where c.relkind in ('r', 'p', 'v', 'm')
              and n.nspname not in ('pg_catalog', 'information_schema')
              and n.nspname not like 'pg_toast%'
              and n.nspname not like 'pg_temp_%'
            order by n.nspname, object_kind, c.relname
            ",
            &[],
        )
        .await?;

    let mut schemas: BTreeMap<String, Vec<DatabaseTreeNode>> = BTreeMap::new();
    for row in rows {
        let schema_name = row.get::<_, String>("schema_name");
        let object_name = row.get::<_, String>("object_name");
        let object_kind = row.get::<_, String>("object_kind");
        let kind = if object_kind == "view" {
            DatabaseObjectKind::View
        } else {
            DatabaseObjectKind::Table
        };
        let id_kind = if object_kind == "view" {
            "view"
        } else {
            "table"
        };

        schemas
            .entry(schema_name.clone())
            .or_default()
            .push(DatabaseTreeNode {
                id: format!("{id_kind}:{schema_name}.{object_name}"),
                label: object_name,
                kind,
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

    Ok(vec![DatabaseTreeNode {
        id: format!("server:{host}:{port}"),
        label: format!("{host}:{port}"),
        kind: DatabaseObjectKind::Database,
        open: Some(true),
        children: Some(vec![DatabaseTreeNode {
            id: format!("database:{database_name}"),
            label: database_name.to_string(),
            kind: DatabaseObjectKind::Database,
            open: Some(true),
            children: Some(schema_nodes),
        }]),
    }])
}

async fn load_object_details(
    client: &Client,
    object_id: &str,
) -> Result<DatabaseObjectDetails, AppError> {
    let object = parse_object_id(object_id)?;
    let columns = load_columns(client, &object).await?;
    let indexes = load_indexes(client, &object).await?;
    let row_count = estimate_row_count(client, &object).await?;
    let safe_edit = indexes.iter().any(|index| index.primary);

    Ok(DatabaseObjectDetails {
        id: object_id.to_string(),
        name: object.name,
        schema: object.schema,
        kind: object.kind,
        engine: "PostgreSQL",
        row_count,
        safe_edit,
        columns,
        indexes,
    })
}

async fn load_columns(
    client: &Client,
    object: &CatalogObject,
) -> Result<Vec<ColumnDefinition>, AppError> {
    let rows = client
        .query(
            "
            select
              a.attname as column_name,
              pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
              not a.attnotnull as nullable,
              exists (
                select 1
                from pg_catalog.pg_index i
                where i.indrelid = c.oid
                  and i.indisprimary
                  and a.attnum = any(i.indkey)
              ) as primary_key,
              exists (
                select 1
                from pg_catalog.pg_index i
                where i.indrelid = c.oid
                  and a.attnum = any(i.indkey)
              ) as indexed
            from pg_catalog.pg_attribute a
            join pg_catalog.pg_class c on c.oid = a.attrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where n.nspname = $1
              and c.relname = $2
              and a.attnum > 0
              and not a.attisdropped
            order by a.attnum
            ",
            &[&object.schema, &object.name],
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| ColumnDefinition {
            name: row.get("column_name"),
            data_type: row.get("data_type"),
            nullable: row.get("nullable"),
            primary_key: row.get("primary_key"),
            indexed: row.get("indexed"),
        })
        .collect())
}

async fn load_indexes(
    client: &Client,
    object: &CatalogObject,
) -> Result<Vec<IndexDefinition>, AppError> {
    let rows = client
        .query(
            "
            select
              ic.relname as index_name,
              i.indisunique as unique_index,
              i.indisprimary as primary_index,
              coalesce(
                array_agg(a.attname order by cols.ord) filter (where a.attname is not null),
                array[]::text[]
              ) as columns
            from pg_catalog.pg_index i
            join pg_catalog.pg_class tc on tc.oid = i.indrelid
            join pg_catalog.pg_namespace n on n.oid = tc.relnamespace
            join pg_catalog.pg_class ic on ic.oid = i.indexrelid
            left join lateral unnest(i.indkey) with ordinality as cols(attnum, ord) on true
            left join pg_catalog.pg_attribute a on a.attrelid = tc.oid and a.attnum = cols.attnum
            where n.nspname = $1
              and tc.relname = $2
            group by ic.relname, i.indisunique, i.indisprimary
            order by i.indisprimary desc, ic.relname
            ",
            &[&object.schema, &object.name],
        )
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| IndexDefinition {
            name: row.get("index_name"),
            columns: row.get("columns"),
            unique: row.get("unique_index"),
            primary: row.get("primary_index"),
        })
        .collect())
}

async fn estimate_row_count(client: &Client, object: &CatalogObject) -> Result<i64, AppError> {
    let row = client
        .query_one(
            "
            select coalesce(c.reltuples::bigint, 0)
            from pg_catalog.pg_class c
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where n.nspname = $1
              and c.relname = $2
            ",
            &[&object.schema, &object.name],
        )
        .await?;

    Ok(row.get(0))
}

fn parse_object_id(object_id: &str) -> Result<CatalogObject, AppError> {
    let (kind, qualified_name) = object_id.split_once(':').ok_or(AppError::InvalidObjectId)?;
    let (schema, name) = qualified_name
        .split_once('.')
        .ok_or(AppError::InvalidObjectId)?;
    let kind = match kind {
        "table" => DatabaseObjectKind::Table,
        "view" => DatabaseObjectKind::View,
        _ => return Err(AppError::InvalidObjectId),
    };

    Ok(CatalogObject {
        schema: schema.to_string(),
        name: name.to_string(),
        kind,
    })
}

fn connection_id(draft: &ConnectionDraft) -> String {
    format!(
        "{}-{}-{}-{}",
        sanitize_id(&draft.name),
        sanitize_id(&draft.host),
        draft.port,
        sanitize_id(&draft.database)
    )
}

fn sanitize_id(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    sanitized.trim_matches('-').to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppState::default()))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let should_prompt = window
                    .state::<Mutex<AppState>>()
                    .lock()
                    .map(|mut guard| {
                        if guard.allow_next_close {
                            guard.allow_next_close = false;
                            false
                        } else {
                            guard.has_unsaved_sql_tabs
                        }
                    })
                    .unwrap_or(false);

                if should_prompt {
                    api.prevent_close();
                    if let Some(webview_window) = window.get_webview_window(window.label()) {
                        let _ = webview_window.eval(
                            "window.dispatchEvent(new CustomEvent('databara-unsaved-tabs-close-requested'));",
                        );
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            test_postgres_connection,
            connect_postgres,
            list_postgres_tree,
            get_postgres_object_details,
            run_postgres_query,
            set_unsaved_sql_tabs,
            close_main_window_after_unsaved_resolution,
            updates_supported
        ])
        .run(tauri::generate_context!())
        .expect("error while running Databara");
}
