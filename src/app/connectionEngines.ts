import type { ConnectionDraft, DatabaseEngine, SslMode } from "./types";

export type ConnectionEngineConfig = {
  id: DatabaseEngine;
  label: string;
  defaultPort: number;
  defaultSslMode: SslMode;
  sslModes: SslMode[];
  placeholders: {
    host: string;
    database: string;
    user: string;
    password: string;
  };
};

export const defaultDatabaseEngine: DatabaseEngine = "postgresql";

export const connectionEngineConfigs: Record<DatabaseEngine, ConnectionEngineConfig> = {
  postgresql: {
    id: "postgresql",
    label: "PostgreSQL",
    defaultPort: 5432,
    defaultSslMode: "Prefer",
    sslModes: ["Prefer", "Require", "Disable"],
    placeholders: {
      host: "localhost",
      database: "databara_dev",
      user: "postgres",
      password: "Enter password",
    },
  },
};

export const connectionEngines = [connectionEngineConfigs.postgresql] as const;

export function getConnectionEngineConfig(engine: DatabaseEngine) {
  return connectionEngineConfigs[engine];
}

export function normalizeDatabaseEngine(engine: unknown): DatabaseEngine {
  return engine === "postgresql" || engine === "PostgreSQL" ? "postgresql" : defaultDatabaseEngine;
}

export function connectionEngineLabel(engine: DatabaseEngine) {
  return getConnectionEngineConfig(engine).label;
}

export function ensureSupportedConnectionEngine(draft: Pick<ConnectionDraft, "engine">) {
  if (draft.engine !== "postgresql") {
    throw new Error(`${connectionEngineLabel(draft.engine)} connections are not supported yet.`);
  }
}
