import { translate } from "./i18n/translate";
import type { ConnectionDraft, DatabaseEngine, SslMode } from "./types";

// Server engines connect over host/port/user; file engines (SQLite) connect to a
// local database file and hide the host/port/user/ssl inputs.
export type ConnectionKind = "server" | "file";

export type ConnectionEngineConfig = {
  id: DatabaseEngine;
  label: string;
  connectionKind: ConnectionKind;
  defaultPort: number;
  defaultSslMode: SslMode;
  sslModes: SslMode[];
  // Example values shown as input placeholders. These are sample identifiers
  // (hostnames, usernames, db names, file paths), not localizable UI copy. The
  // password field's instruction placeholder is localized in the dialog itself.
  placeholders: {
    host: string;
    database: string;
    user: string;
    filePath: string;
  };
};

export const defaultDatabaseEngine: DatabaseEngine = "postgresql";

export const connectionEngineConfigs: Record<DatabaseEngine, ConnectionEngineConfig> = {
  postgresql: {
    id: "postgresql",
    label: "PostgreSQL",
    connectionKind: "server",
    defaultPort: 5432,
    defaultSslMode: "Prefer",
    sslModes: ["Prefer", "Require", "Disable"],
    placeholders: {
      host: "localhost",
      database: "databara_dev",
      user: "postgres",
      filePath: "",
    },
  },
  mysql: {
    id: "mysql",
    label: "MySQL",
    connectionKind: "server",
    defaultPort: 3306,
    defaultSslMode: "Prefer",
    sslModes: ["Prefer", "Require", "Disable"],
    placeholders: {
      host: "localhost",
      database: "databara_dev",
      user: "root",
      filePath: "",
    },
  },
  mariadb: {
    id: "mariadb",
    label: "MariaDB",
    connectionKind: "server",
    defaultPort: 3306,
    defaultSslMode: "Prefer",
    sslModes: ["Prefer", "Require", "Disable"],
    placeholders: {
      host: "localhost",
      database: "databara_dev",
      user: "root",
      filePath: "",
    },
  },
  sqlite: {
    id: "sqlite",
    label: "SQLite",
    connectionKind: "file",
    defaultPort: 0,
    defaultSslMode: "Disable",
    sslModes: [],
    placeholders: {
      host: "",
      database: "",
      user: "",
      filePath: "C:\\path\\to\\database.db",
    },
  },
  mssql: {
    id: "mssql",
    label: "SQL Server",
    connectionKind: "server",
    defaultPort: 1433,
    defaultSslMode: "Prefer",
    sslModes: ["Prefer", "Require", "Disable"],
    placeholders: {
      host: "localhost",
      database: "master",
      user: "sa",
      filePath: "",
    },
  },
};

export const connectionEngines = [
  connectionEngineConfigs.postgresql,
  connectionEngineConfigs.mysql,
  connectionEngineConfigs.mariadb,
  connectionEngineConfigs.sqlite,
  connectionEngineConfigs.mssql,
] as const;

export function getConnectionEngineConfig(engine: DatabaseEngine) {
  return connectionEngineConfigs[engine] ?? connectionEngineConfigs[defaultDatabaseEngine];
}

// Maps both the frontend lowercase ids and the capitalized labels the backend
// reports (e.g. "PostgreSQL", "SQL Server") to a canonical `DatabaseEngine`.
export function normalizeDatabaseEngine(engine: unknown): DatabaseEngine {
  if (typeof engine !== "string") return defaultDatabaseEngine;
  const normalized = engine.trim().toLowerCase();
  switch (normalized) {
    case "postgresql":
    case "postgres":
      return "postgresql";
    case "mysql":
      return "mysql";
    case "mariadb":
      return "mariadb";
    case "sqlite":
      return "sqlite";
    case "mssql":
    case "sql server":
    case "microsoft sql server":
      return "mssql";
    default:
      return defaultDatabaseEngine;
  }
}

export function connectionEngineLabel(engine: DatabaseEngine) {
  return getConnectionEngineConfig(engine).label;
}

export function isFileEngine(engine: DatabaseEngine) {
  return getConnectionEngineConfig(engine).connectionKind === "file";
}

// Guards against a draft whose engine isn't in the registry (e.g. stale persisted
// data). All five registered engines are supported.
export function ensureSupportedConnectionEngine(draft: Pick<ConnectionDraft, "engine">) {
  if (!connectionEngineConfigs[draft.engine]) {
    throw new Error(translate("validation.engineNotSupported", { engine: String(draft.engine) }));
  }
}
