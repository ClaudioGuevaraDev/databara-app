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

// Connections are grouped by server (`host:port`); each server node holds its
// databases, which in turn hold the schema → table tree from the backend. A
// saved-but-not-yet-connected connection contributes a placeholder database
// node so it can be clicked to connect.
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
      label: `${connection.host}:${connection.port}`,
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
    ? `SELECT * FROM ${object.qualifiedName} LIMIT ${limit};`
    : `SELECT * LIMIT ${limit};`;
}

export function buildObjectTabLabel(objectId: string) {
  return parseDatabaseObjectId(objectId)?.qualifiedName ?? objectId;
}

/** Trims surrounding whitespace and a single trailing semicolon so the SQL can be
 * safely embedded as a subquery for pagination. */
export function normalizeBaseSql(sql: string): string {
  return sql.trim().replace(/;\s*$/, "");
}

/** Read queries (SELECT / WITH) are the ones we paginate by wrapping in a subquery. */
export function isReadQuery(sql: string): boolean {
  return /^(select|with)\b/i.test(normalizeBaseSql(sql));
}

/**
 * Detects a trailing `LIMIT n` (optionally followed by `OFFSET m`) and returns the
 * limit value plus the query with that clause removed. Used so the user's own LIMIT
 * becomes the pagination page size while we still page over the full result set.
 * Returns `null` when there's no trailing limit (e.g. a `LIMIT` only in a subquery).
 */
export function parseTrailingLimit(sql: string): { pageSize: number; baseSql: string } | null {
  const normalized = normalizeBaseSql(sql);
  const match = normalized.match(/\s+limit\s+(\d+)\s*(?:offset\s+\d+\s*)?$/i);
  if (!match || match.index === undefined) return null;

  const pageSize = Number(match[1]);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return null;

  return { pageSize, baseSql: normalized.slice(0, match.index).trimEnd() };
}

/**
 * Wraps a read query as a subquery and applies SQL-level pagination via
 * `LIMIT`/`OFFSET` so each page is fetched from the database (no JS slicing).
 * `baseSql` must already be normalized (see {@link normalizeBaseSql}).
 *
 * Note: an `ORDER BY` inside `baseSql` is preserved by PostgreSQL in practice
 * but is not guaranteed by the SQL standard for subqueries — accepted limitation.
 */
export function buildPageSql(baseSql: string, pageSize: number, page: number): string {
  const offset = page * pageSize;
  return `SELECT * FROM (${baseSql}) AS _databara_q LIMIT ${pageSize} OFFSET ${offset}`;
}

/** Total row count for the wrapped read query, used to compute the page count. */
export function buildCountSql(baseSql: string): string {
  return `SELECT count(*) AS total FROM (${baseSql}) AS _databara_q`;
}

/** Human-friendly status message for a non-read statement (DELETE/UPDATE/CREATE…). */
export function formatCommandMessage(
  commandTag: string | null,
  rowsAffected: number | null,
  durationMs: number,
): string {
  const tag = commandTag ?? "OK";
  const affected = rowsAffected != null ? ` · ${rowsAffected} rows affected` : "";
  return `${tag}${affected} · ${durationMs} ms`;
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
