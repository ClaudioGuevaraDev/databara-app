import {
  mockConnections,
  mockExplorerTree,
  mockObjectDdl,
  mockObjectDetails,
  mockQueryHistory,
  mockQueryResults,
  type ConnectionDraft,
  type ConnectionProfile,
  type ConnectionTestResult,
  type DatabaseObjectDetails,
  type DatabaseTreeNode,
  type QueryHistoryItem,
  type QueryResult,
} from "./mockData";

const DEFAULT_LATENCY_MS = 250;

function delay(ms = DEFAULT_LATENCY_MS) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function listConnections(): Promise<ConnectionProfile[]> {
  await delay(120);
  return mockConnections;
}

export async function createMockConnection(draft: ConnectionDraft): Promise<ConnectionProfile> {
  await delay(220);
  return {
    id: `mock:${draft.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: draft.name,
    engine: "PostgreSQL",
    engineVersion: "16",
    host: draft.host,
    port: draft.port,
    database: draft.database,
    user: draft.user,
    status: "connected",
    latencyMs: 14,
    defaultSchema: "public",
    sslMode: draft.sslMode,
  };
}

export async function getExplorerTree(connectionId: string): Promise<DatabaseTreeNode[]> {
  void connectionId;
  await delay(140);
  return mockExplorerTree;
}

export async function refreshWorkspace(connectionId: string) {
  void connectionId;
  await delay(450);
  return {
    tree: mockExplorerTree,
    refreshedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export async function getObjectDetails(objectId: string): Promise<DatabaseObjectDetails> {
  await delay(100);
  return mockObjectDetails[objectId] ?? mockObjectDetails["table:public.customers"];
}

export async function getPreviewResult(objectId: string, limit: number): Promise<QueryResult> {
  await delay(520);
  const result = mockQueryResults[objectId] ?? mockQueryResults["table:public.customers"];
  return {
    ...result,
    rows: result.rows.slice(0, limit),
    rowCount: Math.min(result.rowCount, limit),
    sql: result.sql.replace(/limit \d+;?$/i, `limit ${limit};`),
    message: `SELECT ${Math.min(result.rowCount, limit)}`,
  };
}

export async function getObjectDdl(objectId: string): Promise<string> {
  await delay(180);
  return mockObjectDdl[objectId] ?? mockObjectDdl["table:public.customers"];
}

export async function listQueryHistory(): Promise<QueryHistoryItem[]> {
  await delay(90);
  return mockQueryHistory;
}

export async function runQuery(sql: string, limit: number): Promise<QueryResult> {
  await delay(800);
  const normalizedSql = sql.toLowerCase();
  const key =
    Object.keys(mockQueryResults).find((resultKey) =>
      normalizedSql.includes(resultKey.split(":")[1]),
    ) ?? "query:customer-activity";
  const result = mockQueryResults[key] ?? mockQueryResults["query:customer-activity"];

  return {
    ...result,
    sql,
    rows: result.rows.slice(0, limit),
    rowCount: Math.min(result.rowCount, limit),
    message: `SELECT ${Math.min(result.rowCount, limit)}`,
  };
}

export async function testConnection(draft: ConnectionDraft): Promise<ConnectionTestResult> {
  void draft;
  await delay(700);
  return {
    ok: true,
    latencyMs: 12,
    message: "Connection successful. 12 ms latency.",
  };
}

export function exportQueryResultCsv(result: QueryResult): string {
  const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  return [
    result.columns.map(escapeCell).join(","),
    ...result.rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");
}
