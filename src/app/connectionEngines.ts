import { translate } from "./i18n/translate";
import type { ConnectionDraft, DatabaseEngine, SslMode } from "./types";

export type ConnectionEngineConfig = {
  id: DatabaseEngine;
  label: string;
  defaultPort: number;
  defaultSslMode: SslMode;
  sslModes: SslMode[];
  // Example values shown as input placeholders. These are sample identifiers
  // (hostnames, usernames, db names), not localizable UI copy. The password
  // field's instruction placeholder is localized in the dialog itself.
  placeholders: {
    host: string;
    database: string;
    user: string;
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
    throw new Error(
      translate("validation.engineNotSupported", { engine: connectionEngineLabel(draft.engine) }),
    );
  }
}
