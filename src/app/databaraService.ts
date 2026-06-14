import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionDraft,
  ConnectionProfile,
  ConnectionTestResult,
  DatabaseObjectDetails,
  DatabaseTreeNode,
} from "./types";

export type StoredConnectionDraft = Omit<ConnectionDraft, "password">;

export type ConnectResult = {
  connection: ConnectionProfile;
  tree: DatabaseTreeNode[];
  selectedObjectId: string | null;
  selectedObject: DatabaseObjectDetails | null;
};

const storedConnectionKey = "databara.postgres.connection";
const storedConnectionsKey = "databara.postgres.connections";

export async function testPostgresConnection(
  draft: ConnectionDraft,
): Promise<ConnectionTestResult> {
  return invoke<ConnectionTestResult>("test_postgres_connection", { draft });
}

export async function connectPostgres(draft: ConnectionDraft): Promise<ConnectResult> {
  return invoke<ConnectResult>("connect_postgres", { draft });
}

export async function listPostgresTree(connectionId: string): Promise<DatabaseTreeNode[]> {
  return invoke<DatabaseTreeNode[]>("list_postgres_tree", { connectionId });
}

export async function getPostgresObjectDetails(
  connectionId: string,
  objectId: string,
): Promise<DatabaseObjectDetails> {
  return invoke<DatabaseObjectDetails>("get_postgres_object_details", { connectionId, objectId });
}

export async function setUnsavedSqlTabs(hasUnsaved: boolean): Promise<void> {
  return invoke<void>("set_unsaved_sql_tabs", { hasUnsaved });
}

export async function closeMainWindowAfterUnsavedResolution(): Promise<void> {
  return invoke<void>("close_main_window_after_unsaved_resolution");
}

export function loadStoredConnections(): StoredConnectionDraft[] {
  const rawConnections = window.localStorage.getItem(storedConnectionsKey);

  if (rawConnections) {
    try {
      const connections = JSON.parse(rawConnections) as StoredConnectionDraft[];
      return Array.isArray(connections) ? connections : [];
    } catch {
      window.localStorage.removeItem(storedConnectionsKey);
    }
  }

  const rawLegacyConnection = window.localStorage.getItem(storedConnectionKey);
  if (!rawLegacyConnection) return [];

  try {
    const legacyConnection = JSON.parse(rawLegacyConnection) as StoredConnectionDraft;
    saveStoredConnections([legacyConnection]);
    window.localStorage.removeItem(storedConnectionKey);
    return [legacyConnection];
  } catch {
    window.localStorage.removeItem(storedConnectionKey);
    return [];
  }
}

export function saveStoredConnection(draft: ConnectionDraft): StoredConnectionDraft[] {
  const storedDraft: StoredConnectionDraft = {
    name: draft.name,
    host: draft.host,
    port: draft.port,
    database: draft.database,
    user: draft.user,
    sslMode: draft.sslMode,
  };

  const savedConnections = loadStoredConnections();
  const nextConnections = [
    storedDraft,
    ...savedConnections.filter(
      (connection) =>
        !(
          connection.host === storedDraft.host &&
          connection.port === storedDraft.port &&
          connection.database === storedDraft.database &&
          connection.user === storedDraft.user
        ),
    ),
  ];

  saveStoredConnections(nextConnections);
  return nextConnections;
}

export function deleteStoredConnection(connectionToDelete: StoredConnectionDraft) {
  const nextConnections = loadStoredConnections().filter(
    (connection) =>
      !(
        connection.host === connectionToDelete.host &&
        connection.port === connectionToDelete.port &&
        connection.database === connectionToDelete.database &&
        connection.user === connectionToDelete.user
      ),
  );

  saveStoredConnections(nextConnections);
  return nextConnections;
}

function saveStoredConnections(connections: StoredConnectionDraft[]) {
  window.localStorage.setItem(storedConnectionsKey, JSON.stringify(connections));
}
