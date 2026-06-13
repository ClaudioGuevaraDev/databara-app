import Editor from "@monaco-editor/react";
import {
  Activity,
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns3,
  Copy,
  Cpu,
  Database,
  Download,
  FileCode2,
  Folder,
  History,
  KeyRound,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Table2,
  TerminalSquare,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/utils";

type QueryState = "idle" | "running" | "success" | "error";
type ExplorerTreeNode = {
  label: string;
  icon: LucideIcon;
  open?: boolean;
  children?: ExplorerTreeNode[];
};

const sampleSql = `select
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

const resultRows = [
  ["10021", "ana@databara.dev", "active", "18", "2026-06-12 18:44:02"],
  ["10018", "marco@databara.dev", "active", "11", "2026-06-12 15:02:51"],
  ["09987", "valentina@databara.dev", "active", "9", "2026-06-11 22:13:19"],
  ["09912", "sam@databara.dev", "active", "7", "2026-06-11 09:31:43"],
  ["09844", "nora@databara.dev", "active", "6", "2026-06-10 12:04:08"],
];

const tree: ExplorerTreeNode[] = [
  {
    label: "Local PostgreSQL",
    icon: Database,
    open: true,
    children: [
      {
        label: "databara_dev",
        icon: Database,
        open: true,
        children: [
          {
            label: "public",
            icon: Folder,
            open: true,
            children: [
              { label: "customers", icon: Table2 },
              { label: "orders", icon: Table2 },
              { label: "invoices", icon: Table2 },
              { label: "active_customers", icon: Braces },
            ],
          },
          {
            label: "analytics",
            icon: Folder,
            open: false,
            children: [{ label: "daily_revenue", icon: Table2 }],
          },
        ],
      },
    ],
  },
];

export function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [resultsOpen, setResultsOpen] = useState(true);

  const statusText = useMemo(() => {
    if (queryState === "running") return "Running query...";
    if (queryState === "success") return "5 rows returned in 84 ms";
    if (queryState === "error") return "Syntax error near line 4";
    return "Ready";
  }, [queryState]);

  function runQuery() {
    setResultsOpen(true);
    setQueryState("running");
    window.setTimeout(() => setQueryState("success"), 800);
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-[13px] text-foreground">
      <TopBar onNewConnection={() => setConnectionDialogOpen(true)} />
      <div className="grid min-h-0 flex-1 grid-cols-[48px_288px_minmax(560px,1fr)_336px]">
        <Rail />
        <Explorer onNewConnection={() => setConnectionDialogOpen(true)} />
        <main className="flex min-w-0 flex-col border-r border-border">
          <EditorTabs />
          <QueryToolbar onRun={runQuery} queryState={queryState} />
          <section className="min-h-0 flex-1 bg-[hsl(220_13%_8%)]">
            <Editor
              defaultLanguage="sql"
              defaultValue={sampleSql}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
                fontSize: 13,
                lineHeight: 21,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </section>
          {resultsOpen ? (
            <ResultsPanel queryState={queryState} onClose={() => setResultsOpen(false)} />
          ) : null}
        </main>
        <ObjectDetails />
      </div>
      <StatusBar statusText={statusText} queryState={queryState} />
      {connectionDialogOpen ? (
        <ConnectionDialog onClose={() => setConnectionDialogOpen(false)} />
      ) : null}
    </div>
  );
}

function TopBar({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <header className="chrome-panel hairline flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-primary/40 bg-primary/95 text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.18)]">
          <Database size={16} strokeWidth={2.4} />
        </div>
        <div className="mr-3 leading-none">
          <div className="text-[13px] font-semibold tracking-[0.02em]">Databara</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            local workspace
          </div>
        </div>
        <button className="control flex h-8 items-center gap-2 rounded px-2">
          <Circle size={8} className="fill-emerald-400 text-emerald-400" />
          Local PostgreSQL
          <ChevronDown size={14} />
        </button>
        <div className="command-input ml-2 hidden h-8 min-w-[340px] items-center gap-2 rounded border border-border px-2 text-[12px] text-muted-foreground xl:flex">
          <Search size={14} />
          Search objects, commands, queries
          <span className="ml-auto rounded border border-border bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl P
          </span>
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden"
          title="Search"
        >
          <Search size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onNewConnection}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.15)] hover:brightness-110"
        >
          <Plus size={14} />
          Connection
        </button>
        <IconButton title="Settings">
          <Settings size={15} />
        </IconButton>
      </div>
    </header>
  );
}

function Rail() {
  return (
    <nav className="chrome-panel flex min-h-0 flex-col items-center gap-2 border-r border-border py-2">
      <IconButton title="Explorer">
        <PanelLeft size={16} className="text-primary" />
      </IconButton>
      <IconButton title="SQL editor">
        <FileCode2 size={16} />
      </IconButton>
      <IconButton title="History">
        <History size={16} />
      </IconButton>
      <IconButton title="Security">
        <ShieldCheck size={16} />
      </IconButton>
      <div className="mt-auto h-px w-5 bg-border" />
      <IconButton title="Performance">
        <Cpu size={16} />
      </IconButton>
    </nav>
  );
}

function Explorer({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-r border-border">
      <div className="flex h-9 items-center justify-between border-b border-border px-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Explorer
        </div>
        <div className="flex items-center gap-1">
          <IconButton title="New connection" onClick={onNewConnection}>
            <Plus size={14} />
          </IconButton>
          <IconButton title="Refresh">
            <RefreshCw size={14} />
          </IconButton>
        </div>
      </div>
      <div className="border-b border-border p-2">
        <div className="control flex h-8 items-center gap-2 rounded px-2">
          <Search size={14} />
          <span className="text-[12px]">Filter objects</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-foreground">4</div>
          <div className="text-muted-foreground">tables</div>
        </div>
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-foreground">2</div>
          <div className="text-muted-foreground">schemas</div>
        </div>
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-amber-300">12ms</div>
          <div className="text-muted-foreground">ping</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 py-2">
        {tree.map((node) => (
          <TreeNode key={node.label} node={node} depth={0} />
        ))}
      </div>
    </aside>
  );
}

function TreeNode({ node, depth }: { node: ExplorerTreeNode; depth: number }) {
  const Icon = node.icon;
  const hasChildren = Boolean(node.children?.length);
  return (
    <div>
      <button
        className={cn(
          "group flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          node.label === "customers" &&
            "border border-primary/25 bg-[hsl(var(--primary)/0.12)] text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]",
        )}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
      >
        {hasChildren ? (
          node.open ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Icon
          size={14}
          className={cn(node.label === "customers" ? "text-primary" : "text-muted-foreground")}
        />
        <span className="truncate">{node.label}</span>
        {node.label === "Local PostgreSQL" ? (
          <Circle size={7} className="ml-auto fill-emerald-400 text-emerald-400" />
        ) : null}
      </button>
      {node.open && hasChildren ? (
        <div>
          {node.children?.map((child) => (
            <TreeNode key={child.label} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EditorTabs() {
  return (
    <div className="chrome-panel flex h-9 shrink-0 items-end border-b border-border">
      <button className="flex h-9 max-w-56 items-center gap-2 border-r border-border bg-background px-3 text-[12.5px] shadow-[inset_0_2px_0_hsl(var(--primary))]">
        <FileCode2 size={14} className="text-primary" />
        <span className="truncate">customer_activity.sql</span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </button>
      <button className="flex h-9 max-w-48 items-center gap-2 border-r border-border px-3 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground">
        <FileCode2 size={14} />
        <span className="truncate">scratch query</span>
      </button>
      <button
        className="ml-1 flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        title="New SQL tab"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function QueryToolbar({ onRun, queryState }: { onRun: () => void; queryState: QueryState }) {
  return (
    <div className="chrome-panel flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onRun}
          className="flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.14)] hover:brightness-110"
        >
          {queryState === "running" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          Run
        </button>
        <IconButton title="Stop query">
          <Square size={13} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <button className="control flex h-7 items-center gap-1.5 rounded px-2 text-[12px]">
          Limit 100
          <ChevronDown size={13} />
        </button>
        <button className="control flex h-7 items-center gap-1.5 rounded px-2 text-[12px]">
          public
          <ChevronDown size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Zap size={14} className="text-amber-300" />
        Autocommit on
      </div>
    </div>
  );
}

function ResultsPanel({ queryState, onClose }: { queryState: QueryState; onClose: () => void }) {
  return (
    <section className="chrome-panel flex h-[280px] shrink-0 flex-col border-t border-border">
      <div className="flex h-9 items-center justify-between border-b border-border">
        <div className="flex h-full items-center">
          <button className="flex h-full items-center gap-1.5 border-r border-border bg-background px-3 text-[12px]">
            <Table2 size={14} className="text-primary" />
            Results
          </button>
          <button className="flex h-full items-center gap-1.5 border-r border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">
            <Columns3 size={14} />
            Columns
          </button>
          <button className="flex h-full items-center gap-1.5 border-r border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">
            <TerminalSquare size={14} />
            Messages
          </button>
          <button className="flex h-full items-center gap-1.5 border-r border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">
            <History size={14} />
            History
          </button>
        </div>
        <div className="flex items-center gap-1 pr-2">
          <IconButton title="Copy">
            <Copy size={14} />
          </IconButton>
          <IconButton title="Export CSV">
            <Download size={14} />
          </IconButton>
          <IconButton title="Close results" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {queryState === "running" ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-primary" />
            Running query
          </div>
        ) : queryState === "error" ? (
          <div className="p-4 font-mono text-[12px] text-destructive">
            ERROR: syntax error at or near "from"
          </div>
        ) : (
          <DataGrid />
        )}
      </div>
    </section>
  );
}

function DataGrid() {
  const columns = [
    "customer_id int8",
    "email text",
    "status text",
    "orders int8",
    "last_order_at timestamptz",
  ];
  return (
    <table className="db-grid w-full border-collapse font-mono text-[12px]">
      <thead className="sticky top-0 bg-[hsl(var(--panel-soft))]">
        <tr>
          <th className="w-10 border-b border-r border-border px-2 py-1.5 text-right font-normal text-muted-foreground">
            #
          </th>
          {columns.map((column) => (
            <th
              key={column}
              className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {resultRows.map((row, index) => (
          <tr key={row[0]} className="hover:bg-[hsl(var(--primary)/0.08)]">
            <td className="border-b border-r border-border px-2 py-1.5 text-right text-muted-foreground">
              {index + 1}
            </td>
            {row.map((cell) => (
              <td
                key={cell}
                className="max-w-64 truncate border-b border-r border-border px-2 py-1.5 text-[hsl(210_20%_88%)]"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ObjectDetails() {
  return (
    <aside className="chrome-panel flex min-h-0 flex-col">
      <div className="flex h-9 items-center justify-between border-b border-border px-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Object Details
        </div>
        <IconButton title="More">
          <MoreHorizontal size={14} />
        </IconButton>
      </div>
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-primary/25 bg-primary/10">
            <Table2 size={17} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">public.customers</div>
            <div className="text-[12px] text-muted-foreground">Table - PostgreSQL</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-foreground">5</div>
          <div className="text-muted-foreground">cols</div>
        </div>
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-foreground">3</div>
          <div className="text-muted-foreground">indexes</div>
        </div>
        <div className="bg-[hsl(var(--panel))] px-2 py-2">
          <div className="font-mono text-amber-300">PK</div>
          <div className="text-muted-foreground">safe edit</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <SectionTitle>Columns</SectionTitle>
        <DetailRow name="customer_id" value="bigint - primary key" />
        <DetailRow name="email" value="text - not null" />
        <DetailRow name="status" value="text - indexed" />
        <DetailRow name="created_at" value="timestamptz" />
        <DetailRow name="updated_at" value="timestamptz" />

        <SectionTitle className="mt-5">Indexes</SectionTitle>
        <DetailRow name="customers_pkey" value="customer_id" />
        <DetailRow name="idx_customers_email" value="email unique" />
        <DetailRow name="idx_customers_status" value="status" />

        <SectionTitle className="mt-5">Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <SmallAction icon={Table2} label="Preview" />
          <SmallAction icon={FileCode2} label="DDL" />
          <SmallAction icon={RefreshCw} label="Refresh" />
          <SmallAction icon={Copy} label="Copy name" />
        </div>
      </div>
    </aside>
  );
}

function StatusBar({ statusText, queryState }: { statusText: string; queryState: QueryState }) {
  return (
    <footer className="chrome-panel flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-[12px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Circle size={7} className="fill-emerald-400 text-emerald-400" />
          PostgreSQL 16
        </span>
        <span>databara_dev</span>
        <span>public</span>
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5",
          queryState === "success" && "text-emerald-300",
          queryState === "error" && "text-destructive",
        )}
      >
        {queryState === "running" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Activity size={13} />
        )}
        {statusText}
      </div>
    </footer>
  );
}

function ConnectionDialog({ onClose }: { onClose: () => void }) {
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  function testConnection() {
    setTesting(true);
    setTested(false);
    window.setTimeout(() => {
      setTesting(false);
      setTested(true);
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="chrome-panel hairline w-full max-w-[540px] rounded border border-border shadow-2xl">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound size={16} className="text-primary" />
            New PostgreSQL connection
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          <Field label="Name" defaultValue="Local PostgreSQL" className="col-span-2" />
          <Field label="Host" defaultValue="localhost" />
          <Field label="Port" defaultValue="5432" />
          <Field label="Database" defaultValue="databara_dev" />
          <Field label="User" defaultValue="postgres" />
          <Field label="Password" defaultValue="********" type="password" />
          <label className="grid gap-1.5 text-[12px] text-muted-foreground">
            SSL mode
            <select className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary">
              <option>Prefer</option>
              <option>Require</option>
              <option>Disable</option>
            </select>
          </label>
          <div className="col-span-2 min-h-6 text-[12px]">
            {tested ? (
              <span className="text-emerald-300">Connection successful. 12 ms latency.</span>
            ) : (
              <span className="text-muted-foreground">
                Credentials will be stored locally through the OS keychain in the backend
                implementation.
              </span>
            )}
          </div>
        </div>
        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
          <button
            onClick={testConnection}
            className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px] text-foreground"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Test connection
          </button>
          <button
            onClick={onClose}
            className="h-8 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  type = "text",
  className,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-[12px] text-muted-foreground", className)}>
      {label}
      <input
        type={type}
        defaultValue={defaultValue}
        className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function DetailRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-border/70 py-1.5 text-[12px]">
      <div className="truncate font-mono text-foreground">{name}</div>
      <div className="truncate text-muted-foreground">{value}</div>
    </div>
  );
}

function SmallAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="control flex h-8 items-center gap-1.5 rounded px-2 text-[12px]">
      <Icon size={14} />
      {label}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
