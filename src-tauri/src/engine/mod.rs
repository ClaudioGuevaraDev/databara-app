//! Engine abstraction. `DbSession` is a closed enum over the supported drivers;
//! each variant stores that driver's native handle and forwards the shared
//! operation surface (`list_tree`, `object_details`, `run_query`, `backup`) to its
//! module. Adding an engine = add a variant + a module + match arms + a Cargo dep.

pub mod types;

mod mssql;
mod mysql;
mod postgres;
mod sqlite;

pub use types::*;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};

use tauri::State;

/// A live connection handle. Cloning is cheap (an `Arc`/pool clone), which is what
/// lets `session()` clone the handle out of the state map and release the lock
/// before any query runs.
#[derive(Clone)]
pub enum DbSession {
    Postgres(Arc<tokio_postgres::Client>),
    Sqlite(sqlite::SqliteHandle),
    MySql(mysql::MySqlHandle),
    Mssql(mssql::MssqlHandle),
}

impl DbSession {
    pub async fn list_tree(
        &self,
        profile: &ConnectionProfile,
    ) -> Result<Vec<DatabaseTreeNode>, AppError> {
        match self {
            DbSession::Postgres(client) => postgres::list_tree(client, profile).await,
            DbSession::Sqlite(handle) => sqlite::list_tree(handle, profile).await,
            DbSession::MySql(handle) => mysql::list_tree(handle, profile).await,
            DbSession::Mssql(handle) => mssql::list_tree(handle, profile).await,
        }
    }

    pub async fn object_details(&self, object_id: &str) -> Result<DatabaseObjectDetails, AppError> {
        match self {
            DbSession::Postgres(client) => postgres::object_details(client, object_id).await,
            DbSession::Sqlite(handle) => sqlite::object_details(handle, object_id).await,
            DbSession::MySql(handle) => mysql::object_details(handle, object_id).await,
            DbSession::Mssql(handle) => mssql::object_details(handle, object_id).await,
        }
    }

    pub async fn run_query(&self, sql: &str) -> Result<QueryExecution, AppError> {
        match self {
            DbSession::Postgres(client) => postgres::run_query(client, sql).await,
            DbSession::Sqlite(handle) => sqlite::run_query(handle, sql).await,
            DbSession::MySql(handle) => mysql::run_query(handle, sql).await,
            DbSession::Mssql(handle) => mssql::run_query(handle, sql).await,
        }
    }

    pub async fn backup(
        &self,
        app: &tauri::AppHandle,
        profile: &ConnectionProfile,
        directory: &str,
        file_name: &str,
    ) -> Result<String, AppError> {
        match self {
            DbSession::Postgres(client) => {
                postgres::backup(app, client, profile, directory, file_name).await
            }
            DbSession::Sqlite(handle) => {
                sqlite::backup(handle, app, profile, directory, file_name).await
            }
            // The `.sql` dump generator is PostgreSQL/SQLite-specific for now.
            DbSession::MySql(_) | DbSession::Mssql(_) => Err(AppError::Driver(
                "Backup is currently supported only for PostgreSQL and SQLite.".to_string(),
            )),
        }
    }
}

pub struct Session {
    pub profile: ConnectionProfile,
    pub handle: DbSession,
}

#[derive(Default)]
pub struct AppState {
    pub sessions: HashMap<String, Session>,
    pub has_unsaved_sql_tabs: bool,
    pub allow_next_close: bool,
}

/// Clones the live handle + profile out of the state map and releases the lock, so
/// no query ever runs while the `AppState` mutex is held.
pub fn session(
    state: &State<'_, Mutex<AppState>>,
    connection_id: &str,
) -> Result<(DbSession, ConnectionProfile), AppError> {
    let guard = state.lock().map_err(|_| AppError::StateLock)?;
    let session = guard
        .sessions
        .get(connection_id)
        .ok_or(AppError::ConnectionNotFound)?;
    Ok((session.handle.clone(), session.profile.clone()))
}

/// Opens a live connection and builds the resulting `ConnectionProfile`.
pub async fn connect(draft: ConnectionDraft) -> Result<(DbSession, ConnectionProfile), AppError> {
    let started = Instant::now();
    let cfg = draft.resolve()?;
    let (handle, version, default_schema) = open_session(&cfg).await?;
    let latency_ms = started.elapsed().as_millis();
    let profile = cfg.build_profile(draft.name, version, latency_ms, default_schema);
    Ok((handle, profile))
}

/// Tests a connection without storing a session.
pub async fn test(draft: ConnectionDraft) -> Result<ConnectionTestResult, AppError> {
    let started = Instant::now();
    let cfg = draft.resolve()?;
    let (_, version, _) = open_session(&cfg).await?;
    Ok(ConnectionTestResult {
        ok: true,
        latency_ms: started.elapsed().as_millis(),
        message: format!("Connection successful. {version}."),
    })
}

/// Engine-resolved connection parameters (validated per engine). Kept private to
/// this module; callers go through `connect`/`test`.
enum ResolvedConnectConfig {
    Postgres(postgres::PgConfig),
    Sqlite(sqlite::SqliteConfig),
    MySql(mysql::MysqlConfig, EngineKind),
    Mssql(mssql::MssqlConfig),
}

async fn open_session(
    cfg: &ResolvedConnectConfig,
) -> Result<(DbSession, String, String), AppError> {
    match cfg {
        ResolvedConnectConfig::Postgres(pg) => {
            let client = postgres::open(pg).await?;
            let version = postgres::version(&client).await?;
            Ok((DbSession::Postgres(client), version, "public".to_string()))
        }
        ResolvedConnectConfig::Sqlite(cfg) => {
            let handle = sqlite::open(cfg).await?;
            let version = sqlite::version(&handle).await?;
            Ok((DbSession::Sqlite(handle), version, "main".to_string()))
        }
        ResolvedConnectConfig::MySql(cfg, engine) => {
            let handle = mysql::open(cfg, *engine);
            let version = mysql::version(&handle).await?;
            Ok((DbSession::MySql(handle), version, cfg.database.clone()))
        }
        ResolvedConnectConfig::Mssql(cfg) => {
            let handle = mssql::open(cfg).await?;
            let version = mssql::version(&handle).await?;
            Ok((DbSession::Mssql(handle), version, "dbo".to_string()))
        }
    }
}

impl ResolvedConnectConfig {
    fn engine(&self) -> EngineKind {
        match self {
            ResolvedConnectConfig::Postgres(_) => EngineKind::Postgresql,
            ResolvedConnectConfig::Sqlite(_) => EngineKind::Sqlite,
            ResolvedConnectConfig::MySql(_, engine) => *engine,
            ResolvedConnectConfig::Mssql(_) => EngineKind::Mssql,
        }
    }

    fn build_profile(
        &self,
        name: String,
        version: String,
        latency_ms: u128,
        default_schema: String,
    ) -> ConnectionProfile {
        match self {
            ResolvedConnectConfig::Postgres(pg) => ConnectionProfile {
                id: connection_id(&name, &pg.host, pg.port, &pg.database),
                name,
                engine: self.engine(),
                engine_version: version,
                host: pg.host.clone(),
                port: pg.port,
                database: pg.database.clone(),
                user: pg.user.clone(),
                status: "connected",
                latency_ms,
                default_schema,
                ssl_mode: pg.ssl_mode,
                file_path: None,
                trust_server_cert: None,
            },
            ResolvedConnectConfig::Sqlite(cfg) => ConnectionProfile {
                // `host` carries the file path so id/tree/keychain keys are distinct
                // per file (they're all derived from engine/host/port on the frontend);
                // `database` carries the file name for the tree label.
                id: connection_id(&name, &cfg.file_path, 0, ""),
                name,
                engine: self.engine(),
                engine_version: version,
                host: cfg.file_path.clone(),
                port: 0,
                database: std::path::Path::new(&cfg.file_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| cfg.file_path.clone()),
                user: String::new(),
                status: "connected",
                latency_ms,
                default_schema,
                ssl_mode: SslModeDraft::Disable,
                file_path: Some(cfg.file_path.clone()),
                trust_server_cert: None,
            },
            ResolvedConnectConfig::MySql(cfg, _) => ConnectionProfile {
                id: connection_id(&name, &cfg.host, cfg.port, &cfg.database),
                name,
                engine: self.engine(),
                engine_version: version,
                host: cfg.host.clone(),
                port: cfg.port,
                database: cfg.database.clone(),
                user: cfg.user.clone(),
                status: "connected",
                latency_ms,
                default_schema,
                ssl_mode: cfg.ssl_mode,
                file_path: None,
                trust_server_cert: None,
            },
            ResolvedConnectConfig::Mssql(cfg) => ConnectionProfile {
                id: connection_id(&name, &cfg.host, cfg.port, &cfg.database),
                name,
                engine: self.engine(),
                engine_version: version,
                host: cfg.host.clone(),
                port: cfg.port,
                database: cfg.database.clone(),
                user: cfg.user.clone(),
                status: "connected",
                latency_ms,
                default_schema,
                ssl_mode: cfg.ssl_mode,
                file_path: None,
                trust_server_cert: Some(cfg.trust_server_cert),
            },
        }
    }
}

impl ConnectionDraft {
    fn resolve(&self) -> Result<ResolvedConnectConfig, AppError> {
        match self.engine {
            EngineKind::Postgresql => Ok(ResolvedConnectConfig::Postgres(postgres::PgConfig {
                host: self.require_host()?,
                port: self.port.unwrap_or(5432),
                database: self.require_database()?,
                user: self.require_user()?,
                password: self.password.clone().unwrap_or_default(),
                ssl_mode: self.ssl_mode.unwrap_or(SslModeDraft::Prefer),
            })),
            EngineKind::Sqlite => Ok(ResolvedConnectConfig::Sqlite(sqlite::SqliteConfig {
                file_path: non_empty(self.file_path.as_deref(), "file path")?,
            })),
            EngineKind::Mysql | EngineKind::Mariadb => Ok(ResolvedConnectConfig::MySql(
                mysql::MysqlConfig {
                    host: self.require_host()?,
                    port: self.port.unwrap_or(3306),
                    database: self.require_database()?,
                    user: self.require_user()?,
                    password: self.password.clone().unwrap_or_default(),
                    ssl_mode: self.ssl_mode.unwrap_or(SslModeDraft::Prefer),
                },
                self.engine,
            )),
            EngineKind::Mssql => Ok(ResolvedConnectConfig::Mssql(mssql::MssqlConfig {
                host: self.require_host()?,
                port: self.port.unwrap_or(1433),
                database: self.require_database()?,
                user: self.require_user()?,
                password: self.password.clone().unwrap_or_default(),
                ssl_mode: self.ssl_mode.unwrap_or(SslModeDraft::Prefer),
                trust_server_cert: self.trust_server_cert.unwrap_or(false),
            })),
        }
    }

    fn require_host(&self) -> Result<String, AppError> {
        non_empty(self.host.as_deref(), "host")
    }

    fn require_database(&self) -> Result<String, AppError> {
        non_empty(self.database.as_deref(), "database")
    }

    fn require_user(&self) -> Result<String, AppError> {
        non_empty(self.user.as_deref(), "user")
    }
}

fn non_empty(value: Option<&str>, field: &str) -> Result<String, AppError> {
    match value {
        Some(text) if !text.trim().is_empty() => Ok(text.to_string()),
        _ => Err(AppError::Connection(format!("Missing {field}"))),
    }
}
