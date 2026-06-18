import { connectionEngineLabel } from "../connectionEngines";
import type { StoredConnectionDraft } from "../databaraService";
import type { ConnectionDraft, DatabaseTreeNode } from "../types";
import { savedConnectionNodeId } from "./workspaceCore";

export function serverNodeId(connection: Pick<ConnectionDraft, "engine" | "host" | "port">) {
  return `server:${connection.engine}:${connection.host}:${connection.port}`;
}

function activeDatabaseNodeId(connection: StoredConnectionDraft) {
  return `database:${connection.database}`;
}

export function connectionKey(
  connection: Pick<ConnectionDraft, "database" | "engine" | "host" | "port" | "user">,
) {
  return `${connection.engine}:${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

export function buildStoredConnectionTree(
  storedConnections: StoredConnectionDraft[],
  activeTree: DatabaseTreeNode[],
) {
  const serverNodes = new Map<string, DatabaseTreeNode>();

  for (const node of activeTree) {
    serverNodes.set(node.id, node);
  }

  for (const connection of storedConnections) {
    const serverId = serverNodeId(connection);
    const serverNode = serverNodes.get(serverId) ?? {
      children: [],
      id: serverId,
      kind: "database" as const,
      label: `${connectionEngineLabel(connection.engine)} ${connection.host}:${connection.port}`,
      open: true,
    };
    const children = serverNode.children ?? [];
    const hasDatabase = children.some((node) => node.label === connection.database);

    if (!hasDatabase) {
      children.push({
        id: savedConnectionNodeId(connection),
        kind: "database",
        label: connection.database,
      });
    }

    serverNodes.set(serverId, { ...serverNode, children });
  }

  return [...serverNodes.values()].sort((first, second) => first.label.localeCompare(second.label));
}

export function mergeExplorerTree(
  currentTree: DatabaseTreeNode[],
  incomingTree: DatabaseTreeNode[],
) {
  const nextServers = new Map(currentTree.map((node) => [node.id, node]));

  for (const incomingServer of incomingTree) {
    const currentServer = nextServers.get(incomingServer.id);
    if (!currentServer) {
      nextServers.set(incomingServer.id, incomingServer);
      continue;
    }

    const databaseNodes = new Map((currentServer.children ?? []).map((node) => [node.label, node]));

    for (const incomingDatabase of incomingServer.children ?? []) {
      databaseNodes.set(incomingDatabase.label, incomingDatabase);
    }

    nextServers.set(incomingServer.id, {
      ...incomingServer,
      children: [...databaseNodes.values()].sort((first, second) =>
        first.label.localeCompare(second.label),
      ),
    });
  }

  return [...nextServers.values()].sort((first, second) => first.label.localeCompare(second.label));
}

export function removeConnectionFromTree(
  tree: DatabaseTreeNode[],
  connectionToDelete: StoredConnectionDraft,
) {
  const serverId = serverNodeId(connectionToDelete);
  const databaseIds = new Set([
    savedConnectionNodeId(connectionToDelete),
    activeDatabaseNodeId(connectionToDelete),
  ]);

  return tree
    .map((serverNode) => {
      if (serverNode.id !== serverId) return serverNode;

      const children = (serverNode.children ?? []).filter((child) => !databaseIds.has(child.id));
      return { ...serverNode, children };
    })
    .filter((serverNode) => (serverNode.children?.length ?? 0) > 0);
}

export function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export function connectionDisplayName(
  draft: Pick<ConnectionDraft, "database" | "engine" | "host" | "port">,
) {
  return `${draft.database} (${connectionEngineLabel(draft.engine)} ${draft.host}:${draft.port})`;
}

function parseDatabaseObjectId(objectId: string) {
  const [, qualifiedName] = objectId.split(":");
  const [schemaName, objectName] = qualifiedName?.split(".") ?? [];

  if (!schemaName || !objectName) return null;

  return {
    qualifiedName: `${schemaName}.${objectName}`,
  };
}

export function buildDefaultObjectSql(objectId: string, limit: number) {
  const object = parseDatabaseObjectId(objectId);
  return object
    ? `select * from ${object.qualifiedName} limit ${limit};`
    : `select * limit ${limit};`;
}

export function buildObjectTabLabel(objectId: string) {
  return parseDatabaseObjectId(objectId)?.qualifiedName ?? objectId;
}

export async function copyText(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}
