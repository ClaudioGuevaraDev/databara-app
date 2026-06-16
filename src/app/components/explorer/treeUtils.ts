import type { StoredConnectionDraft } from "../../databaraService";
import type { DatabaseTreeNode } from "../../types";
import { savedConnectionNodeId } from "../../workspace/workspaceCore";

export function connectionKey(
  connection: Pick<StoredConnectionDraft, "host" | "port" | "database" | "user">,
) {
  return `${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

export function findServerForNode(
  nodes: DatabaseTreeNode[],
  nodeId: string,
  serverId = "",
): string | null {
  for (const node of nodes) {
    const currentServerId = node.id.startsWith("server:") ? node.id : serverId;
    if (node.id === nodeId) return currentServerId || null;

    const childMatch = node.children
      ? findServerForNode(node.children, nodeId, currentServerId)
      : null;
    if (childMatch) return childMatch;
  }

  return null;
}

export function findStoredConnectionForNode(
  node: DatabaseTreeNode,
  tree: DatabaseTreeNode[],
  storedConnections: StoredConnectionDraft[],
) {
  if (node.id.startsWith("saved-connection:")) {
    return storedConnections.find((connection) => savedConnectionNodeId(connection) === node.id);
  }

  if (!node.id.startsWith("database:")) return null;

  const serverId = findServerForNode(tree, node.id);
  if (!serverId) return null;

  return (
    storedConnections.find(
      (connection) =>
        `server:${connection.host}:${connection.port}` === serverId &&
        `database:${connection.database}` === node.id,
    ) ?? null
  );
}

export function getExplorerStats(nodes: DatabaseTreeNode[]) {
  return nodes.reduce(
    (stats, node) => {
      if (node.kind === "schema") stats.schemas += 1;
      if (node.kind === "table") stats.tables += 1;
      if (node.children) {
        const childStats = getExplorerStats(node.children);
        stats.schemas += childStats.schemas;
        stats.tables += childStats.tables;
      }
      return stats;
    },
    { schemas: 0, tables: 0 },
  );
}
