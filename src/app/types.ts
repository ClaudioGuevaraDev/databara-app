export type ConnectionStatus = "connected" | "disconnected";
export type DatabaseObjectKind = "database" | "schema" | "table" | "view";
export type ResultPanelTab = "results" | "columns" | "schema";
export type QueryState = "idle" | "running" | "success" | "error" | "cancelled";

export type ConnectionProfile = {
  id: string;
  name: string;
  engine: "PostgreSQL";
  engineVersion: string;
  host: string;
  port: number;
  database: string;
  user: string;
  status: ConnectionStatus;
  latencyMs: number;
  defaultSchema: string;
  sslMode: "Prefer" | "Require" | "Disable";
};

export type DatabaseTreeNode = {
  id: string;
  label: string;
  kind: DatabaseObjectKind;
  open?: boolean;
  children?: DatabaseTreeNode[];
};

export type ColumnDefinition = {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey?: boolean;
  indexed?: boolean;
};

export type IndexDefinition = {
  name: string;
  columns: string[];
  unique?: boolean;
  primary?: boolean;
};

export type DatabaseObjectDetails = {
  id: string;
  name: string;
  schema: string;
  kind: Extract<DatabaseObjectKind, "table" | "view">;
  engine: ConnectionProfile["engine"];
  rowCount: number;
  safeEdit: boolean;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
};

export type SqlTab = {
  id: string;
  label: string;
  sql: string;
  savedSql?: string;
  dirty: boolean;
  state: "temporary" | "official";
  objectId?: string;
  connectionKey?: string;
};

export type QueryResult = {
  id: string;
  sql: string;
  columns: string[];
  rows: string[][];
  durationMs: number;
  rowCount: number;
  message: string;
};

export type ConnectionDraft = {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: "Prefer" | "Require" | "Disable";
};

export type ConnectionTestResult = {
  ok: boolean;
  latencyMs: number;
  message: string;
};
