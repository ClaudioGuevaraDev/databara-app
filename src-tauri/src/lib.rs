use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;
use tokio::time::timeout;
use tokio_postgres::{config::SslMode, Client, Config, NoTls};

#[derive(Default)]
struct AppState {
    sessions: HashMap<String, PostgresSession>,
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
    #[error("PostgreSQL error: {0}")]
    Postgres(#[from] tokio_postgres::Error),
    #[error("TLS error: {0}")]
    Tls(#[from] native_tls::Error),
    #[error("Operation timed out")]
    Timeout,
    #[error("Internal state lock failed")]
    StateLock,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
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
    let selected_object_id = first_selectable_object(&tree);
    let selected_object = match &selected_object_id {
        Some(object_id) => Some(load_object_details(&client, object_id).await?),
        None => None,
    };
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
        selected_object_id,
        selected_object,
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

fn first_selectable_object(nodes: &[DatabaseTreeNode]) -> Option<String> {
    for node in nodes {
        if matches!(
            node.kind,
            DatabaseObjectKind::Table | DatabaseObjectKind::View
        ) {
            return Some(node.id.clone());
        }
        if let Some(children) = &node.children {
            if let Some(id) = first_selectable_object(children) {
                return Some(id);
            }
        }
    }

    None
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
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            test_postgres_connection,
            connect_postgres,
            list_postgres_tree,
            get_postgres_object_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running Databara");
}
