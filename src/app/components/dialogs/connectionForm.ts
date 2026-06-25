import { connectionEngineLabel, defaultDatabaseEngine } from "../../connectionEngines";
import { translate } from "../../i18n/translate";
import type { ConnectionDraft } from "../../types";

export type ConnectionFormDraft = Omit<ConnectionDraft, "port"> & { port: string };

export function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return translate("validation.unexpectedError");
}

export function connectionDisplayName(
  draft: Pick<ConnectionDraft, "database" | "engine" | "host" | "port">,
) {
  return `${draft.database} (${connectionEngineLabel(draft.engine)} ${draft.host}:${draft.port})`;
}

export function buildConnectionDraft(formDraft: ConnectionFormDraft): ConnectionDraft {
  const engine = formDraft.engine ?? defaultDatabaseEngine;
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
