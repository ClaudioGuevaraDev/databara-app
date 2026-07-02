//! Engine-agnostic types that cross the Tauri IPC boundary, plus the shared
//! error type and small id/​backup helpers. Engine-specific logic lives in the
//! per-engine modules (`postgres`, `mysql`, `sqlite`, `mssql`).

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// The database engines Databara can talk to. Serializes to the lowercase ids the
/// frontend `DatabaseEngine` union uses (`postgresql`, `mysql`, …).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineKind {
    Postgresql,
    Mysql,
    Mariadb,
    Sqlite,
    Mssql,
}

impl EngineKind {
    /// Human-readable label used in status messages and error prefixes.
    pub fn label(self) -> &'static str {
        match self {
            EngineKind::Postgresql => "PostgreSQL",
            EngineKind::Mysql => "MySQL",
            EngineKind::Mariadb => "MariaDB",
            EngineKind::Sqlite => "SQLite",
            EngineKind::Mssql => "SQL Server",
        }
    }
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Connection failed: {0}")]
    Connection(String),
    #[error("Connection not found")]
    ConnectionNotFound,
    #[error("Invalid object id")]
    InvalidObjectId,
    /// Engine driver error, already formatted with an engine-specific prefix.
    #[error("{0}")]
    Driver(String),
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SslModeDraft {
    Prefer,
    Require,
    Disable,
}

/// The connection form payload from the frontend. Server engines use
/// host/port/user/password/ssl; the file engine (SQLite) uses `file_path`.
/// All engine-specific fields are optional so one shape serves every engine;
/// `ConnectionDraft::resolve` validates the required subset per engine.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionDraft {
    pub engine: EngineKind,
    pub name: String,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub database: Option<String>,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub ssl_mode: Option<SslModeDraft>,
    #[serde(default)]
    pub file_path: Option<String>,
    // Consumed by the SQL Server engine (Phase 4); accepted now so the wire shape
    // is stable across engines.
    #[serde(default)]
    #[allow(dead_code)]
    pub trust_server_cert: Option<bool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub engine: EngineKind,
    pub engine_version: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub status: &'static str,
    pub latency_ms: u128,
    pub default_schema: String,
    pub ssl_mode: SslModeDraft,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trust_server_cert: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    pub connection: ConnectionProfile,
    pub tree: Vec<DatabaseTreeNode>,
    pub selected_object_id: Option<String>,
    pub selected_object: Option<DatabaseObjectDetails>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub latency_ms: u128,
    pub message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseTreeNode {
    pub id: String,
    pub label: String,
    pub kind: DatabaseObjectKind,
    pub open: Option<bool>,
    pub children: Option<Vec<DatabaseTreeNode>>,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseObjectKind {
    Database,
    Schema,
    Table,
    View,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseObjectDetails {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub kind: DatabaseObjectKind,
    pub engine: EngineKind,
    pub row_count: i64,
    pub safe_edit: bool,
    pub columns: Vec<ColumnDefinition>,
    pub indexes: Vec<IndexDefinition>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDefinition {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub primary_key: bool,
    pub indexed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexDefinition {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    pub primary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryExecution {
    pub columns: Vec<String>,
    pub column_types: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub row_count: usize,
    pub duration_ms: u128,
    pub rows_affected: Option<u64>,
    pub command_tag: Option<String>,
}

/// A schema-qualified object parsed from a tree-node id (`table:schema.name`).
#[derive(Clone)]
pub struct CatalogObject {
    pub schema: String,
    pub name: String,
    pub kind: DatabaseObjectKind,
}

/// Parses a tree-node object id of the form `{kind}:{schema}.{name}` (the schema
/// slot holds the database name for schemaless engines like MySQL/SQLite).
pub fn parse_object_id(object_id: &str) -> Result<CatalogObject, AppError> {
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

/// A stable, filesystem-safe session id derived from the connection's identity.
pub fn connection_id(name: &str, host: &str, port: u16, database: &str) -> String {
    format!(
        "{}-{}-{}-{}",
        sanitize_id(name),
        sanitize_id(host),
        port,
        sanitize_id(database)
    )
}

pub fn sanitize_id(value: &str) -> String {
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

/// Event the backup dialog listens on to render live progress (0–100) while the
/// `.sql` dump is being written.
pub const BACKUP_PROGRESS_EVENT: &str = "databara://backup-progress";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupProgress {
    pub percent: u8,
    pub table: String,
}

pub fn emit_backup_progress(app: &tauri::AppHandle, percent: u8, table: &str) {
    use tauri::Emitter;
    let _ = app.emit(
        BACKUP_PROGRESS_EVENT,
        BackupProgress {
            percent,
            table: table.to_string(),
        },
    );
}
