export type ConnectionStatus = "connected" | "disconnected";
export type DatabaseObjectKind = "database" | "schema" | "table" | "view";
export type ResultPanelTab = "results" | "columns";

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
  dirty: boolean;
};

export type QueryHistoryItem = {
  id: string;
  label: string;
  sql: string;
  executedAt: string;
  durationMs: number;
  rowCount: number;
  status: "success" | "cancelled";
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
  sslMode: "Prefer" | "Require" | "Disable";
};

export type ConnectionTestResult = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

export const mockConnections: ConnectionProfile[] = [
  {
    id: "local-postgres",
    name: "Local PostgreSQL",
    engine: "PostgreSQL",
    engineVersion: "16",
    host: "localhost",
    port: 5432,
    database: "databara_dev",
    user: "postgres",
    status: "connected",
    latencyMs: 12,
    defaultSchema: "public",
    sslMode: "Prefer",
  },
  {
    id: "warehouse-readonly",
    name: "Warehouse Readonly",
    engine: "PostgreSQL",
    engineVersion: "15",
    host: "warehouse.internal",
    port: 5432,
    database: "analytics",
    user: "readonly",
    status: "disconnected",
    latencyMs: 38,
    defaultSchema: "analytics",
    sslMode: "Require",
  },
];

export const mockExplorerTree: DatabaseTreeNode[] = [
  {
    id: "connection:local-postgres",
    label: "Local PostgreSQL",
    kind: "database",
    open: true,
    children: [
      {
        id: "database:databara_dev",
        label: "databara_dev",
        kind: "database",
        open: true,
        children: [
          {
            id: "schema:public",
            label: "public",
            kind: "schema",
            open: true,
            children: [
              { id: "table:public.customers", label: "customers", kind: "table" },
              { id: "table:public.orders", label: "orders", kind: "table" },
              { id: "table:public.invoices", label: "invoices", kind: "table" },
              { id: "table:public.products", label: "products", kind: "table" },
              { id: "view:public.active_customers", label: "active_customers", kind: "view" },
            ],
          },
          {
            id: "schema:analytics",
            label: "analytics",
            kind: "schema",
            open: true,
            children: [
              { id: "table:analytics.daily_revenue", label: "daily_revenue", kind: "table" },
              { id: "view:analytics.customer_segments", label: "customer_segments", kind: "view" },
            ],
          },
        ],
      },
    ],
  },
];

export const mockObjectDetails: Record<string, DatabaseObjectDetails> = {
  "table:public.customers": {
    id: "table:public.customers",
    name: "customers",
    schema: "public",
    kind: "table",
    engine: "PostgreSQL",
    rowCount: 48192,
    safeEdit: true,
    columns: [
      { name: "customer_id", dataType: "bigint", nullable: false, primaryKey: true },
      { name: "email", dataType: "text", nullable: false, indexed: true },
      { name: "status", dataType: "text", nullable: false, indexed: true },
      { name: "plan", dataType: "text", nullable: false, indexed: true },
      { name: "created_at", dataType: "timestamptz", nullable: false },
      { name: "updated_at", dataType: "timestamptz", nullable: true },
    ],
    indexes: [
      { name: "customers_pkey", columns: ["customer_id"], primary: true, unique: true },
      { name: "idx_customers_email", columns: ["email"], unique: true },
      { name: "idx_customers_status", columns: ["status"] },
      { name: "idx_customers_plan", columns: ["plan"] },
    ],
  },
  "table:public.orders": {
    id: "table:public.orders",
    name: "orders",
    schema: "public",
    kind: "table",
    engine: "PostgreSQL",
    rowCount: 128774,
    safeEdit: true,
    columns: [
      { name: "order_id", dataType: "bigint", nullable: false, primaryKey: true },
      { name: "customer_id", dataType: "bigint", nullable: false, indexed: true },
      { name: "total_cents", dataType: "integer", nullable: false },
      { name: "currency", dataType: "char(3)", nullable: false },
      { name: "status", dataType: "text", nullable: false, indexed: true },
      { name: "created_at", dataType: "timestamptz", nullable: false, indexed: true },
    ],
    indexes: [
      { name: "orders_pkey", columns: ["order_id"], primary: true, unique: true },
      { name: "idx_orders_customer_id", columns: ["customer_id"] },
      { name: "idx_orders_created_at", columns: ["created_at"] },
    ],
  },
  "table:public.invoices": {
    id: "table:public.invoices",
    name: "invoices",
    schema: "public",
    kind: "table",
    engine: "PostgreSQL",
    rowCount: 34610,
    safeEdit: false,
    columns: [
      { name: "invoice_id", dataType: "bigint", nullable: false, primaryKey: true },
      { name: "order_id", dataType: "bigint", nullable: false, indexed: true },
      { name: "amount_cents", dataType: "integer", nullable: false },
      { name: "status", dataType: "text", nullable: false, indexed: true },
      { name: "issued_at", dataType: "timestamptz", nullable: false },
    ],
    indexes: [
      { name: "invoices_pkey", columns: ["invoice_id"], primary: true, unique: true },
      { name: "idx_invoices_order_id", columns: ["order_id"] },
      { name: "idx_invoices_status", columns: ["status"] },
    ],
  },
  "table:public.products": {
    id: "table:public.products",
    name: "products",
    schema: "public",
    kind: "table",
    engine: "PostgreSQL",
    rowCount: 842,
    safeEdit: true,
    columns: [
      { name: "product_id", dataType: "bigint", nullable: false, primaryKey: true },
      { name: "sku", dataType: "text", nullable: false, indexed: true },
      { name: "name", dataType: "text", nullable: false },
      { name: "category", dataType: "text", nullable: false, indexed: true },
      { name: "price_cents", dataType: "integer", nullable: false },
    ],
    indexes: [
      { name: "products_pkey", columns: ["product_id"], primary: true, unique: true },
      { name: "idx_products_sku", columns: ["sku"], unique: true },
      { name: "idx_products_category", columns: ["category"] },
    ],
  },
  "view:public.active_customers": {
    id: "view:public.active_customers",
    name: "active_customers",
    schema: "public",
    kind: "view",
    engine: "PostgreSQL",
    rowCount: 18340,
    safeEdit: false,
    columns: [
      { name: "customer_id", dataType: "bigint", nullable: false },
      { name: "email", dataType: "text", nullable: false },
      { name: "last_order_at", dataType: "timestamptz", nullable: true },
      { name: "lifetime_value_cents", dataType: "integer", nullable: false },
    ],
    indexes: [],
  },
  "table:analytics.daily_revenue": {
    id: "table:analytics.daily_revenue",
    name: "daily_revenue",
    schema: "analytics",
    kind: "table",
    engine: "PostgreSQL",
    rowCount: 732,
    safeEdit: false,
    columns: [
      { name: "revenue_date", dataType: "date", nullable: false, primaryKey: true },
      { name: "gross_cents", dataType: "integer", nullable: false },
      { name: "refund_cents", dataType: "integer", nullable: false },
      { name: "net_cents", dataType: "integer", nullable: false },
    ],
    indexes: [
      { name: "daily_revenue_pkey", columns: ["revenue_date"], primary: true, unique: true },
    ],
  },
  "view:analytics.customer_segments": {
    id: "view:analytics.customer_segments",
    name: "customer_segments",
    schema: "analytics",
    kind: "view",
    engine: "PostgreSQL",
    rowCount: 7,
    safeEdit: false,
    columns: [
      { name: "segment", dataType: "text", nullable: false },
      { name: "customers", dataType: "integer", nullable: false },
      { name: "avg_ltv_cents", dataType: "integer", nullable: false },
    ],
    indexes: [],
  },
};

export const mockSampleSql = `select
  c.customer_id,
  c.email,
  c.status,
  count(o.order_id) as orders,
  max(o.created_at) as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.customer_id
where c.status = 'active'
group by c.customer_id, c.email, c.status
order by last_order_at desc
limit 100;`;

export const mockSqlTabs: SqlTab[] = [
  { id: "tab:customer-activity", label: "customer_activity.sql", sql: mockSampleSql, dirty: true },
  {
    id: "tab:invoice-aging",
    label: "invoice aging",
    sql: "select status, count(*) as invoices from public.invoices group by status;",
    dirty: false,
  },
];

export const mockQueryResults: Record<string, QueryResult> = {
  "table:public.customers": {
    id: "query:customers-preview",
    sql: "select * from public.customers limit 100;",
    columns: [
      "customer_id int8",
      "email text",
      "status text",
      "plan text",
      "created_at timestamptz",
    ],
    rows: [
      ["10021", "ana@databara.dev", "active", "enterprise", "2025-11-04 12:16:22"],
      ["10018", "marco@databara.dev", "active", "pro", "2025-12-19 08:44:10"],
      ["09987", "valentina@databara.dev", "active", "team", "2026-01-07 18:01:45"],
      ["09912", "sam@databara.dev", "trialing", "starter", "2026-02-14 09:31:43"],
      ["09844", "nora@databara.dev", "active", "pro", "2026-03-21 12:04:08"],
      ["09821", "leo@databara.dev", "paused", "starter", "2026-04-02 16:22:56"],
      ["09790", "mila@databara.dev", "active", "enterprise", "2026-04-15 11:19:07"],
      ["09745", "diego@databara.dev", "active", "team", "2026-05-03 14:08:33"],
    ],
    durationMs: 84,
    rowCount: 8,
    message: "SELECT 8",
  },
  "table:public.orders": {
    id: "query:orders-preview",
    sql: "select * from public.orders limit 100;",
    columns: [
      "order_id int8",
      "customer_id int8",
      "total_cents int4",
      "currency char(3)",
      "status text",
    ],
    rows: [
      ["88091", "10021", "129900", "USD", "paid"],
      ["88064", "10018", "59900", "USD", "paid"],
      ["87992", "09987", "21900", "USD", "refunded"],
      ["87945", "09912", "9900", "USD", "paid"],
      ["87881", "09844", "34900", "USD", "pending"],
      ["87834", "09790", "189900", "USD", "paid"],
    ],
    durationMs: 63,
    rowCount: 6,
    message: "SELECT 6",
  },
  "table:public.invoices": {
    id: "query:invoices-preview",
    sql: "select * from public.invoices limit 100;",
    columns: [
      "invoice_id int8",
      "order_id int8",
      "amount_cents int4",
      "status text",
      "issued_at timestamptz",
    ],
    rows: [
      ["77210", "88091", "129900", "paid", "2026-06-12 18:44:02"],
      ["77188", "88064", "59900", "paid", "2026-06-12 15:02:51"],
      ["77117", "87992", "21900", "refunded", "2026-06-11 22:13:19"],
      ["77052", "87945", "9900", "paid", "2026-06-11 09:31:43"],
      ["76994", "87881", "34900", "open", "2026-06-10 12:04:08"],
    ],
    durationMs: 47,
    rowCount: 5,
    message: "SELECT 5",
  },
  "table:public.products": {
    id: "query:products-preview",
    sql: "select * from public.products limit 100;",
    columns: ["product_id int8", "sku text", "name text", "category text", "price_cents int4"],
    rows: [
      ["501", "DBR-PRO-M", "Databara Pro Monthly", "subscription", "5900"],
      ["502", "DBR-TEAM-M", "Databara Team Monthly", "subscription", "12900"],
      ["503", "DBR-ENT-Y", "Databara Enterprise Yearly", "subscription", "149900"],
      ["611", "ADD-OBS", "Observability Add-on", "addon", "3900"],
    ],
    durationMs: 31,
    rowCount: 4,
    message: "SELECT 4",
  },
  "view:public.active_customers": {
    id: "query:active-customers-preview",
    sql: "select * from public.active_customers limit 100;",
    columns: [
      "customer_id int8",
      "email text",
      "last_order_at timestamptz",
      "lifetime_value_cents int4",
    ],
    rows: [
      ["10021", "ana@databara.dev", "2026-06-12 18:44:02", "489100"],
      ["10018", "marco@databara.dev", "2026-06-12 15:02:51", "220400"],
      ["09987", "valentina@databara.dev", "2026-06-11 22:13:19", "184900"],
      ["09844", "nora@databara.dev", "2026-06-10 12:04:08", "99100"],
    ],
    durationMs: 92,
    rowCount: 4,
    message: "SELECT 4",
  },
  "table:analytics.daily_revenue": {
    id: "query:daily-revenue-preview",
    sql: "select * from analytics.daily_revenue limit 100;",
    columns: ["revenue_date date", "gross_cents int4", "refund_cents int4", "net_cents int4"],
    rows: [
      ["2026-06-12", "842900", "21900", "821000"],
      ["2026-06-11", "799400", "0", "799400"],
      ["2026-06-10", "821200", "9900", "811300"],
      ["2026-06-09", "756100", "18900", "737200"],
    ],
    durationMs: 58,
    rowCount: 4,
    message: "SELECT 4",
  },
  "view:analytics.customer_segments": {
    id: "query:customer-segments-preview",
    sql: "select * from analytics.customer_segments;",
    columns: ["segment text", "customers int4", "avg_ltv_cents int4"],
    rows: [
      ["enterprise", "1240", "438200"],
      ["team", "6310", "156900"],
      ["pro", "9801", "89300"],
      ["starter", "15422", "21100"],
    ],
    durationMs: 66,
    rowCount: 4,
    message: "SELECT 4",
  },
  "query:customer-activity": {
    id: "query:customer-activity",
    sql: mockSampleSql,
    columns: [
      "customer_id int8",
      "email text",
      "status text",
      "orders int8",
      "last_order_at timestamptz",
    ],
    rows: [
      ["10021", "ana@databara.dev", "active", "18", "2026-06-12 18:44:02"],
      ["10018", "marco@databara.dev", "active", "11", "2026-06-12 15:02:51"],
      ["09987", "valentina@databara.dev", "active", "9", "2026-06-11 22:13:19"],
      ["09912", "sam@databara.dev", "active", "7", "2026-06-11 09:31:43"],
      ["09844", "nora@databara.dev", "active", "6", "2026-06-10 12:04:08"],
    ],
    durationMs: 84,
    rowCount: 5,
    message: "SELECT 5",
  },
};

export const mockObjectDdl: Record<string, string> = Object.fromEntries(
  Object.values(mockObjectDetails).map((details) => [
    details.id,
    `create ${details.kind} ${details.schema}.${details.name} (
${details.columns
  .map(
    (column) =>
      `  ${column.name} ${column.dataType}${column.nullable ? "" : " not null"}${
        column.primaryKey ? " primary key" : ""
      }`,
  )
  .join(",\n")}
);`,
  ]),
);

export const mockQueryHistory: QueryHistoryItem[] = [
  {
    id: "history:customer-activity",
    label: "customer_activity.sql",
    sql: mockSampleSql,
    executedAt: "2026-06-13T09:48:21.000Z",
    durationMs: 84,
    rowCount: 5,
    status: "success",
  },
  {
    id: "history:invoice-aging",
    label: "invoice aging",
    sql: "select status, count(*) as invoices from public.invoices group by status;",
    executedAt: "2026-06-13T09:32:10.000Z",
    durationMs: 41,
    rowCount: 4,
    status: "success",
  },
  {
    id: "history:slow-orders",
    label: "slow orders scan",
    sql: "select * from public.orders where total_cents > 10000 order by created_at desc;",
    executedAt: "2026-06-13T09:12:44.000Z",
    durationMs: 1240,
    rowCount: 100,
    status: "cancelled",
  },
];
