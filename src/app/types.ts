export type ConnectionStatus = "connected" | "disconnected";
export type DatabaseEngine = "postgresql";
export type DatabaseObjectKind = "database" | "schema" | "table" | "view";
export type ResultPanelTab = "results" | "columns" | "schema";
export type QueryState = "idle" | "running" | "success" | "error" | "cancelled";
export type SslMode = "Prefer" | "Require" | "Disable";

export type ConnectionProfile = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  engineVersion: string;
  host: string;
  port: number;
  database: string;
  user: string;
  status: ConnectionStatus;
  latencyMs: number;
  defaultSchema: string;
  sslMode: SslMode;
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

export type UpdatePhase =
  | "checking"
  | "downloading"
  | "installing"
  | "done"
  | "error"
  | "unavailable";

export type UpdateProgress = {
  phase: UpdatePhase;
  downloaded: number;
  total: number;
  version?: string;
  notes?: string;
  error?: string;
};

export type ToastTone = "default" | "success" | "warning";

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
};

// Supported UI languages. Only English is offered today; the union grows as
// more locales are added to the i18n catalog.
export type Language = "en";

export type NotificationPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const QUERY_PAGE_SIZES = [50, 100, 200, 500] as const;

export type QueryPagination = {
  page: number; // 0-based
  pageSize: number;
  totalRows: number;
  // true when the page size comes from the user's own LIMIT (selector is locked)
  pageSizeLocked: boolean;
};

export type ConnectionDraft = {
  engine: DatabaseEngine;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: SslMode;
};

export type ConnectionTestResult = {
  ok: boolean;
  latencyMs: number;
  message: string;
};
