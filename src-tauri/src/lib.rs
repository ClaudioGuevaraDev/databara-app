use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use thiserror::Error;
use tokio::time::timeout;
use tokio_postgres::{
    config::SslMode,
    types::{Kind, Type},
    Client, Config, NoTls, SimpleQueryMessage,
};

// Service name under which connection passwords are stored in the OS keychain
// (Windows Credential Manager / macOS Keychain / Linux Secret Service). Entries
// are keyed by the frontend's connection key as the account.
const KEYCHAIN_SERVICE: &str = "dev.databara.app";

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
    #[error("Keychain error: {0}")]
    Keychain(String),
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
    column_types: Vec<String>,
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

// Persists a connection password in the OS keychain so the connection can be
// reconnected on startup without prompting (opt-in "keep connections active").
#[tauri::command]
fn store_connection_password(account: String, password: String) -> Result<(), AppError> {
    let entry =
        keyring::Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| AppError::Keychain(e.to_string()))?;
    entry
        .set_password(&password)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

// Returns the stored password for a connection, or None when nothing is saved.
#[tauri::command]
fn get_connection_password(account: String) -> Result<Option<String>, AppError> {
    let entry =
        keyring::Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

// Removes a connection's stored password (on disable or connection deletion).
#[tauri::command]
fn delete_connection_password(account: String) -> Result<(), AppError> {
    let entry =
        keyring::Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
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

    // Prepare first so we can read column metadata (names + types) even when the
    // result is empty. Preparing also rejects multi-statement SQL, keeping the
    // single-result QueryExecution shape valid.
    let statement = client.prepare(&sql).await?;
    let columns: Vec<String> = statement
        .columns()
        .iter()
        .map(|column| column.name().to_string())
        .collect();
    let column_types: Vec<Type> = statement
        .columns()
        .iter()
        .map(|column| column.type_().clone())
        .collect();

    // Execute via the simple query protocol so every value comes back in Postgres'
    // canonical text form. Unlike binary decoding (query_raw on a prepared
    // statement), this handles every type — money, interval, cidr, macaddr, inet,
    // bytea, arrays, ranges, enums, etc. — without per-type decoders.
    let start = Instant::now();
    let messages = client.simple_query(&sql).await?;
    let duration_ms = start.elapsed().as_millis();

    let mut converted: Vec<Vec<Option<String>>> = Vec::new();
    let mut rows_affected: Option<u64> = None;
    for message in messages {
        match message {
            SimpleQueryMessage::Row(row) => {
                converted.push(
                    (0..row.len())
                        .map(|index| format_cell(row.get(index), column_types.get(index)))
                        .collect(),
                );
            }
            SimpleQueryMessage::CommandComplete(count) => rows_affected = Some(count),
            // SimpleQueryMessage is #[non_exhaustive], so a catch-all is required.
            _ => {}
        }
    }

    // tokio-postgres 0.7 doesn't expose the command tag here, so derive the verb
    // from the SQL itself (e.g. "DELETE", "INSERT", "CREATE").
    let command_tag = sql
        .split_whitespace()
        .next()
        .map(|word| word.to_ascii_uppercase());

    let column_categories = column_types
        .iter()
        .map(|column_type| json_category(column_type).to_string())
        .collect();

    Ok(QueryExecution {
        columns,
        column_types: column_categories,
        row_count: converted.len(),
        rows: converted,
        duration_ms,
        rows_affected,
        command_tag,
    })
}

/// Maps a PostgreSQL type to a coarse JSON category the frontend uses to render
/// values with their natural JSON type in the JSON results view. Arrays are
/// converted to JSON text by `format_cell`, so they're reported as "json" too;
/// types without a native JSON representation (timestamps, money, …) are "string".
fn json_category(column_type: &Type) -> &'static str {
    if let Kind::Array(_) = column_type.kind() {
        return "json";
    }
    match *column_type {
        Type::INT2
        | Type::INT4
        | Type::INT8
        | Type::FLOAT4
        | Type::FLOAT8
        | Type::NUMERIC
        | Type::OID => "number",
        Type::BOOL => "boolean",
        Type::JSON | Type::JSONB => "json",
        _ => "string",
    }
}

/// Normalizes the canonical text Postgres returns for a cell, returning `None` for
/// SQL NULL. Most types pass through unchanged; a few are reshaped: bool as
/// `true`/`false`, timestamptz in UTC, json/jsonb re-serialized via serde, and
/// arrays converted from Postgres' `{…}` literal into a JSON array so the JSON
/// view can render them as real nested arrays.
fn format_cell(value: Option<&str>, column_type: Option<&Type>) -> Option<String> {
    let value = value?;

    if let Some(column_type) = column_type {
        if let Kind::Array(element_type) = column_type.kind() {
            return Some(postgres_array_to_json(value, element_type).to_string());
        }
    }

    match column_type {
        Some(&Type::BOOL) => Some(match value {
            "t" => "true".to_string(),
            "f" => "false".to_string(),
            other => other.to_string(),
        }),
        Some(&Type::TIMESTAMPTZ) => Some(
            chrono::DateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S%.f%#z")
                .map(|dt| dt.with_timezone(&chrono::Utc).to_string())
                .unwrap_or_else(|_| value.to_string()),
        ),
        Some(&Type::JSON) | Some(&Type::JSONB) => Some(
            serde_json::from_str::<serde_json::Value>(value)
                .map(|parsed| parsed.to_string())
                .unwrap_or_else(|_| value.to_string()),
        ),
        _ => Some(value.to_string()),
    }
}

/// Parses a PostgreSQL array literal (e.g. `{1,2,3}`, `{red,"a,b",NULL}`, nested
/// `{{1,2},{3,4}}`, or `jsonb[]` with quoted/escaped elements) into a JSON value,
/// converting each leaf element according to its element type. Falls back to the
/// raw string as a JSON string if the input isn't a `{…}` literal.
fn postgres_array_to_json(text: &str, element_type: &Type) -> serde_json::Value {
    let chars: Vec<char> = text.chars().collect();
    let mut pos = 0;
    if chars.first() != Some(&'{') {
        return serde_json::Value::String(text.to_string());
    }
    parse_array_value(&chars, &mut pos, element_type)
}

/// Parses a `{…}` group starting at `*pos` (which must point at `{`), recursing
/// into nested arrays and advancing `*pos` past the closing `}`.
fn parse_array_value(chars: &[char], pos: &mut usize, element_type: &Type) -> serde_json::Value {
    let mut items: Vec<serde_json::Value> = Vec::new();
    *pos += 1; // consume '{'
    while *pos < chars.len() {
        match chars[*pos] {
            '}' => {
                *pos += 1;
                break;
            }
            ',' => *pos += 1,
            '{' => items.push(parse_array_value(chars, pos, element_type)),
            '"' => {
                let element = parse_quoted_element(chars, pos);
                items.push(array_element_to_json(&element, element_type));
            }
            _ => {
                let start = *pos;
                while *pos < chars.len() && chars[*pos] != ',' && chars[*pos] != '}' {
                    *pos += 1;
                }
                let element: String = chars[start..*pos].iter().collect();
                let element = element.trim();
                if element.eq_ignore_ascii_case("NULL") {
                    items.push(serde_json::Value::Null);
                } else {
                    items.push(array_element_to_json(element, element_type));
                }
            }
        }
    }
    serde_json::Value::Array(items)
}

/// Reads a double-quoted array element starting at `*pos` (pointing at the opening
/// quote), un-escaping `\\` and `\"`, and advances `*pos` past the closing quote.
fn parse_quoted_element(chars: &[char], pos: &mut usize) -> String {
    let mut out = String::new();
    *pos += 1; // consume opening quote
    while *pos < chars.len() {
        match chars[*pos] {
            '\\' if *pos + 1 < chars.len() => {
                out.push(chars[*pos + 1]);
                *pos += 2;
            }
            '"' => {
                *pos += 1;
                break;
            }
            other => {
                out.push(other);
                *pos += 1;
            }
        }
    }
    out
}

/// Converts a single (already un-quoted/un-escaped) array element to a JSON value
/// based on the array's element type, mirroring `json_category`'s coarse buckets.
fn array_element_to_json(element: &str, element_type: &Type) -> serde_json::Value {
    match *element_type {
        Type::BOOL => serde_json::Value::Bool(element == "t" || element == "true"),
        Type::INT2 | Type::INT4 | Type::INT8 | Type::FLOAT4 | Type::FLOAT8 | Type::NUMERIC
        | Type::OID => {
            if let Ok(int_value) = element.parse::<i64>() {
                serde_json::Value::from(int_value)
            } else if let Some(num) = element.parse::<f64>().ok().and_then(serde_json::Number::from_f64)
            {
                serde_json::Value::Number(num)
            } else {
                serde_json::Value::String(element.to_string())
            }
        }
        Type::JSON | Type::JSONB => serde_json::from_str(element)
            .unwrap_or_else(|_| serde_json::Value::String(element.to_string())),
        _ => serde_json::Value::String(element.to_string()),
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

/// Finish the startup sequence: close the splash window and reveal the main
/// window. The main window starts hidden (`visible: false` in tauri.conf.json)
/// so the frontend can do its slow startup work (reconnecting saved databases,
/// checking for updates) behind the splash, then call this once it is ready —
/// so the main window appears already fully populated.
#[tauri::command]
fn complete_startup(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
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

/// Writes UTF-8 text to a user-chosen path. The frontend picks the path via the
/// native save dialog (tauri-plugin-dialog) and passes it here so result exports
/// land wherever the user wants, using std::fs directly (no fs-plugin scope needed).
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), AppError> {
    std::fs::write(&path, content).map_err(|e| AppError::Connection(e.to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            store_connection_password,
            get_connection_password,
            delete_connection_password,
            list_postgres_tree,
            get_postgres_object_details,
            run_postgres_query,
            set_unsaved_sql_tabs,
            close_main_window_after_unsaved_resolution,
            updates_supported,
            complete_startup,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Databara");
}
