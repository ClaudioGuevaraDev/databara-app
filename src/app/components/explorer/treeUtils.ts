import type { StoredConnectionDraft } from "../../databaraService";
import type { DatabaseTreeNode } from "../../types";
import { savedConnectionNodeId } from "../../workspace/workspaceCore";
import { serverNodeId } from "../../workspace/workspaceContext.utils";

export function connectionKey(
  connection: Pick<StoredConnectionDraft, "database" | "engine" | "host" | "port" | "user">,
) {
  return `${connection.engine}:${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

// Prunes the tree to the branches containing table/view leaves whose label matches
// `query` (case-insensitive). Container nodes (server/database/schema) are kept
// only when they have a matching descendant. Node ids and structure are preserved
// so selection and `toggledNodes` keys keep working when the filter clears.
export function filterExplorerTree(nodes: DatabaseTreeNode[], query: string): DatabaseTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const prune = (list: DatabaseTreeNode[]): DatabaseTreeNode[] => {
    const out: DatabaseTreeNode[] = [];
    for (const node of list) {
      if (node.kind === "table" || node.kind === "view") {
        if (node.label.toLowerCase().includes(q)) out.push(node);
        continue;
      }
      const children = node.children ? prune(node.children) : [];
      if (children.length > 0) out.push({ ...node, children });
    }
    return out;
  };

  return prune(nodes);
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
        serverNodeId(connection) === serverId && `database:${connection.database}` === node.id,
    ) ?? null
  );
}
