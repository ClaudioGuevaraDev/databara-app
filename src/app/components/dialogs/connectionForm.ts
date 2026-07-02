import {
  connectionEngineLabel,
  defaultDatabaseEngine,
  isFileEngine,
} from "../../connectionEngines";
import { translate } from "../../i18n/translate";
import type { ConnectionDraft } from "../../types";

export type ConnectionFormDraft = Omit<ConnectionDraft, "port"> & { port: string };

export function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return translate("validation.unexpectedError");
}

// Last path segment of a file path (works for both `/` and `\` separators).
export function fileBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function connectionDisplayName(
  draft: Pick<ConnectionDraft, "database" | "engine" | "host" | "port" | "filePath">,
) {
  const label = connectionEngineLabel(draft.engine);
  if (isFileEngine(draft.engine)) {
    const fileName = fileBaseName(draft.filePath ?? "") || label;
    return `${fileName} (${label})`;
  }
  return `${draft.database} (${label} ${draft.host}:${draft.port})`;
}

export function buildConnectionDraft(formDraft: ConnectionFormDraft): ConnectionDraft {
  const engine = formDraft.engine ?? defaultDatabaseEngine;

  // File engines (SQLite) are identified by a path; host/port/user/db don't apply.
  if (isFileEngine(engine)) {
    const filePath = (formDraft.filePath ?? "").trim();
    if (!filePath) {
      throw new Error(translate("validation.requiredFile"));
    }
    return {
      ...formDraft,
      // `database` = file name (for the tree label); `host` = full path (identity).
      database: fileBaseName(filePath),
      engine,
      filePath,
      host: filePath,
      password: "",
      port: 0,
      sslMode: "Disable",
      user: "",
    };
  }

  const host = formDraft.host.trim();
  const port = formDraft.port.trim();
  const database = formDraft.database.trim();
  const user = formDraft.user.trim();

  if (!host || !port || !database || !user) {
    throw new Error(translate("validation.requiredFields"));
  }

  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(translate("validation.invalidPort"));
  }

  return {
    ...formDraft,
    database,
    engine,
    host,
    password: formDraft.password,
    port: parsedPort,
    user,
  };
}
