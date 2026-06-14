import type { ConnectionDraft } from "../../types";

export type ConnectionFormDraft = Omit<ConnectionDraft, "port"> & { port: string };

export function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export function connectionDisplayName(draft: Pick<ConnectionDraft, "database" | "host" | "port">) {
  return `${draft.database} (${draft.host}:${draft.port})`;
}

export function buildConnectionDraft(formDraft: ConnectionFormDraft): ConnectionDraft {
  const host = formDraft.host.trim();
  const port = formDraft.port.trim();
  const database = formDraft.database.trim();
  const user = formDraft.user.trim();

  if (!host || !port || !database || !user) {
    throw new Error("Host, port, database, and user are required.");
  }

  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("Port must be a valid positive number.");
  }

  return {
    ...formDraft,
    database,
    host,
    password: formDraft.password,
    port: parsedPort,
    user,
  };
}
