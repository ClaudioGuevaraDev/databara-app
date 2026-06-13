import Editor from "@monaco-editor/react";
import {
  Activity,
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns3,
  Copy,
  Database,
  Download,
  FileCode2,
  Folder,
  KeyRound,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import {
  connectPostgres,
  deleteStoredConnection,
  getPostgresObjectDetails,
  listPostgresTree,
  loadStoredConnections,
  saveStoredConnection,
  testPostgresConnection,
  type StoredConnectionDraft,
} from "./databaraService";
import { exportQueryResultCsv } from "./mockDatabaraService";
import {
  mockSampleSql,
  mockSqlTabs,
  type ColumnDefinition,
  type ConnectionDraft,
  type ConnectionProfile,
  type DatabaseObjectDetails,
  type DatabaseObjectKind,
  type DatabaseTreeNode,
  type QueryResult,
  type ResultPanelTab,
  type SqlTab,
} from "./mockData";

type QueryState = "idle" | "running" | "success" | "error" | "cancelled";
type Toast = { text: string; tone?: "default" | "success" | "warning" };

const rowLimits = [25, 50, 100, 500];
const schemas = ["public", "analytics"];

function serverNodeId(host: string, port: number) {
  return `server:${host}:${port}`;
}

function savedConnectionNodeId(connection: StoredConnectionDraft) {
  return `saved-connection:${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

function activeDatabaseNodeId(connection: StoredConnectionDraft) {
  return `database:${connection.database}`;
}

function isSavedConnectionNodeId(nodeId: string) {
  return nodeId.startsWith("saved-connection:");
}

function buildStoredConnectionTree(
  storedConnections: StoredConnectionDraft[],
  activeTree: DatabaseTreeNode[],
) {
  const serverNodes = new Map<string, DatabaseTreeNode>();

  for (const node of activeTree) {
    serverNodes.set(node.id, node);
  }

  for (const connection of storedConnections) {
    const serverId = serverNodeId(connection.host, connection.port);
    const serverNode = serverNodes.get(serverId) ?? {
      id: serverId,
      label: `${connection.host}:${connection.port}`,
      kind: "database" as const,
      open: true,
      children: [],
    };
    const children = serverNode.children ?? [];
    const hasDatabase = children.some((node) => node.label === connection.database);

    if (!hasDatabase) {
      children.push({
        id: savedConnectionNodeId(connection),
        label: connection.database,
        kind: "database",
      });
    }

    serverNodes.set(serverId, { ...serverNode, children });
  }

  return [...serverNodes.values()].sort((first, second) => first.label.localeCompare(second.label));
}

function mergeExplorerTree(currentTree: DatabaseTreeNode[], incomingTree: DatabaseTreeNode[]) {
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

function removeConnectionFromTree(
  tree: DatabaseTreeNode[],
  connectionToDelete: StoredConnectionDraft,
) {
  const serverId = serverNodeId(connectionToDelete.host, connectionToDelete.port);
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

function findServerForNode(
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

function findStoredConnectionForNode(
  node: DatabaseTreeNode,
  tree: DatabaseTreeNode[],
  storedConnections: StoredConnectionDraft[],
) {
  if (isSavedConnectionNodeId(node.id)) {
    return storedConnections.find((connection) => savedConnectionNodeId(connection) === node.id);
  }

  if (!node.id.startsWith("database:")) return null;

  const serverId = findServerForNode(tree, node.id);
  if (!serverId) return null;

  return (
    storedConnections.find(
      (connection) =>
        serverNodeId(connection.host, connection.port) === serverId &&
        activeDatabaseNodeId(connection) === node.id,
    ) ?? null
  );
}

function getExplorerStats(nodes: DatabaseTreeNode[]) {
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

function formatColumn(column: ColumnDefinition) {
  const traits = [
    column.primaryKey ? "primary key" : null,
    column.nullable ? "nullable" : "not null",
    column.indexed ? "indexed" : null,
  ].filter(Boolean);

  return `${column.dataType}${traits.length ? ` - ${traits.join(", ")}` : ""}`;
}

function formatIndex(index: DatabaseObjectDetails["indexes"][number]) {
  const traits = [index.primary ? "primary" : null, index.unique ? "unique" : null].filter(Boolean);
  return `${index.columns.join(", ")}${traits.length ? ` ${traits.join(" ")}` : ""}`;
}

async function copyText(text: string) {
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

function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

function connectionDisplayName(draft: Pick<ConnectionDraft, "database" | "host" | "port">) {
  return `${draft.database} (${draft.host}:${draft.port})`;
}

export function App() {
  const [storedConnections, setStoredConnections] = useState<StoredConnectionDraft[]>(() =>
    loadStoredConnections(),
  );
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(
    () => storedConnections.length === 0,
  );
  const [dialogInitialDraft, setDialogInitialDraft] = useState<StoredConnectionDraft | null>(null);
  const [passwordConnection, setPasswordConnection] = useState<StoredConnectionDraft | null>(null);
  const [deleteConnectionRequest, setDeleteConnectionRequest] =
    useState<StoredConnectionDraft | null>(null);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [activeExplorerTree, setActiveExplorerTree] = useState<DatabaseTreeNode[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedObject, setSelectedObject] = useState<DatabaseObjectDetails | null>(null);
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>(mockSqlTabs);
  const [activeTabId, setActiveTabId] = useState(mockSqlTabs[0].id);
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [queryResult] = useState<QueryResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultPanelTab>("results");
  const [resultsOpen, setResultsOpen] = useState(true);
  const [rowLimit, setRowLimit] = useState(100);
  const [schema, setSchema] = useState("public");
  const [toast, setToast] = useState<Toast>(() => ({
    text: "Ready",
  }));
  const [refreshing, setRefreshing] = useState(false);
  const runTokenRef = useRef(0);

  const activeConnection = connections[0] ?? null;
  const requiresConnection = connections.length === 0;
  const activeTab = sqlTabs.find((tab) => tab.id === activeTabId) ?? sqlTabs[0];
  const hasStoredConnections = storedConnections.length > 0;
  const explorerTree = useMemo(
    () => buildStoredConnectionTree(storedConnections, activeExplorerTree),
    [activeExplorerTree, storedConnections],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedObject() {
      if (requiresConnection || !activeConnection || !selectedObjectId) return;
      try {
        const details = await getPostgresObjectDetails(activeConnection.id, selectedObjectId);
        if (!cancelled) setSelectedObject(details);
      } catch (error) {
        if (!cancelled) {
          setSelectedObject(null);
          notify(readErrorMessage(error), "warning");
        }
      }
    }

    void loadSelectedObject();

    return () => {
      cancelled = true;
    };
  }, [activeConnection, requiresConnection, selectedObjectId]);

  const statusText = useMemo(() => {
    if (queryState === "running") return "Running query...";
    if (queryState === "success" && queryResult) {
      return `${queryResult.rowCount} rows returned in ${queryResult.durationMs} ms`;
    }
    if (queryState === "cancelled") return "Query cancelled";
    if (queryState === "error") return "Query failed";
    if (requiresConnection) return "";
    return toast.text;
  }, [queryResult, queryState, requiresConnection, toast.text]);

  function notify(text: string, tone: Toast["tone"] = "default") {
    setToast({ text, tone });
  }

  function updateActiveSql(sql: string) {
    setSqlTabs((tabs) =>
      tabs.map((tab) => (tab.id === activeTabId ? { ...tab, sql, dirty: true } : tab)),
    );
  }

  function createSqlTab(sql = "select now();") {
    const tab: SqlTab = {
      id: `tab:scratch-${Date.now()}`,
      label: `scratch ${sqlTabs.length + 1}`,
      sql,
      dirty: true,
    };
    setSqlTabs((tabs) => [...tabs, tab]);
    setActiveTabId(tab.id);
    notify("New SQL tab created");
  }

  function stopQuery() {
    if (queryState !== "running") {
      notify("No running query to stop");
      return;
    }

    runTokenRef.current += 1;
    setQueryState("cancelled");
    notify("Query cancelled", "warning");
  }

  function runQuery() {
    if (requiresConnection) {
      openNewConnectionDialog();
      notify("Create a connection before running queries", "warning");
      return;
    }

    notify("SQL execution is not enabled yet", "warning");
  }

  async function refreshAll() {
    if (requiresConnection) {
      notify("Create a connection before refreshing", "warning");
      return;
    }

    setRefreshing(true);
    try {
      const tree = await listPostgresTree(activeConnection!.id);
      setActiveExplorerTree((current) => mergeExplorerTree(current, tree));
      setRefreshing(false);
      notify("Workspace refreshed", "success");
    } catch (error) {
      setRefreshing(false);
      notify(readErrorMessage(error), "warning");
    }
  }

  async function previewObject(objectId = selectedObjectId) {
    if (requiresConnection) {
      notify("Create a connection before previewing objects", "warning");
      return;
    }

    void objectId;
    notify("Preview is not enabled until SQL execution is implemented", "warning");
  }

  async function loadDdl() {
    if (requiresConnection) {
      notify("Create a connection before loading DDL", "warning");
      return;
    }

    notify("DDL generation is not enabled yet", "warning");
  }

  function cycleLimit() {
    const nextLimit = rowLimits[(rowLimits.indexOf(rowLimit) + 1) % rowLimits.length];
    setRowLimit(nextLimit);
    notify(`Row limit set to ${nextLimit}`);
  }

  function cycleSchema() {
    const nextSchema = schemas[(schemas.indexOf(schema) + 1) % schemas.length];
    setSchema(nextSchema);
    notify(`Schema set to ${nextSchema}`);
  }

  async function copyResult() {
    if (!queryResult) {
      notify("Run a query before copying results", "warning");
      return;
    }

    await copyText(
      [queryResult.columns.join("\t"), ...queryResult.rows.map((row) => row.join("\t"))].join("\n"),
    );
    notify("Results copied to clipboard", "success");
  }

  function exportCsv() {
    if (!queryResult) {
      notify("Run a query before exporting CSV", "warning");
      return;
    }

    const blob = new Blob([exportQueryResultCsv(queryResult)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "databara-results.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("CSV export started", "success");
  }

  async function copyObjectName() {
    if (!selectedObject) return;
    await copyText(`${selectedObject.schema}.${selectedObject.name}`);
    notify("Object name copied", "success");
  }

  async function connectAndStoreConnection(draft: ConnectionDraft) {
    const connectionDraft = { ...draft, name: connectionDisplayName(draft) };
    const result = await connectPostgres(connectionDraft);
    const nextStoredConnections = saveStoredConnection(connectionDraft);
    setStoredConnections(nextStoredConnections);
    setConnections((current) => [
      result.connection,
      ...current.filter((item) => item.id !== result.connection.id),
    ]);
    setActiveExplorerTree((current) => mergeExplorerTree(current, result.tree));
    setSelectedObjectId(result.selectedObjectId ?? "");
    setSelectedObject(result.selectedObject);
    notify(`${result.connection.name} connected`, "success");
  }

  async function saveConnection(draft: ConnectionDraft) {
    try {
      await connectAndStoreConnection(draft);
      setConnectionDialogOpen(false);
    } catch (error) {
      notify(readErrorMessage(error), "warning");
    }
  }

  function openNewConnectionDialog() {
    setDialogInitialDraft(null);
    setConnectionDialogOpen(true);
  }

  function openSavedConnection(nodeId: string) {
    const connection = storedConnections.find((item) => savedConnectionNodeId(item) === nodeId);
    if (!connection) return;

    setPasswordConnection(connection);
    notify(`Enter the password for ${connection.database}`, "warning");
  }

  async function connectStoredConnection(connection: StoredConnectionDraft, password: string) {
    await connectAndStoreConnection({
      ...connection,
      name: connectionDisplayName(connection),
      password,
    });
    setPasswordConnection(null);
  }

  function deleteConnection(nodeId: string) {
    const connection = storedConnections.find((item) => savedConnectionNodeId(item) === nodeId);
    if (!connection) return;

    setDeleteConnectionRequest(connection);
  }

  function confirmDeleteConnection(connection: StoredConnectionDraft) {
    const nextStoredConnections = deleteStoredConnection(connection);
    setStoredConnections(nextStoredConnections);
    setActiveExplorerTree((current) => removeConnectionFromTree(current, connection));
    setConnections((current) =>
      current.filter(
        (item) =>
          !(
            item.host === connection.host &&
            item.port === connection.port &&
            item.database === connection.database &&
            item.user === connection.user
          ),
      ),
    );

    if (selectedObjectId && activeConnection?.database === connection.database) {
      setSelectedObjectId("");
      setSelectedObject(null);
    }

    if (nextStoredConnections.length === 0) {
      setDialogInitialDraft(null);
      setConnectionDialogOpen(true);
    }

    notify(`${connection.database} removed`, "success");
    setDeleteConnectionRequest(null);
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-[13px] text-foreground">
      <TopBar onNewConnection={openNewConnectionDialog} />
      <div
        className={cn(
          "grid min-h-0 flex-1",
          requiresConnection
            ? "grid-cols-[288px_minmax(560px,1fr)]"
            : "grid-cols-[288px_minmax(560px,1fr)_336px]",
        )}
      >
        <Explorer
          activeConnection={activeConnection}
          nodes={explorerTree}
          storedConnections={storedConnections}
          collapsedNodes={collapsedNodes}
          refreshing={refreshing}
          selectedObjectId={selectedObjectId}
          onToggleNode={(nodeId) =>
            setCollapsedNodes((current) => {
              const next = new Set(current);
              if (next.has(nodeId)) next.delete(nodeId);
              else next.add(nodeId);
              return next;
            })
          }
          onSelectObject={setSelectedObjectId}
          onConnectSaved={openSavedConnection}
          onDeleteSaved={deleteConnection}
          onNewConnection={openNewConnectionDialog}
          onRefresh={refreshAll}
        />
        <main className="flex min-w-0 flex-col">
          {requiresConnection ? (
            <EmptyWorkspace
              hasStoredConnections={hasStoredConnections}
              onNewConnection={openNewConnectionDialog}
            />
          ) : (
            <>
              <EditorTabs
                tabs={sqlTabs}
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
                onNewTab={() => createSqlTab()}
              />
              <QueryToolbar
                queryState={queryState}
                rowLimit={rowLimit}
                schema={schema}
                onRun={() => runQuery()}
                onStop={stopQuery}
                onCycleLimit={cycleLimit}
                onCycleSchema={cycleSchema}
              />
              <section className="min-h-0 flex-1 bg-[hsl(220_13%_8%)]">
                <Editor
                  key={activeTab?.id}
                  defaultLanguage="sql"
                  value={activeTab?.sql ?? mockSampleSql}
                  theme="vs-dark"
                  onChange={(value) => updateActiveSql(value ?? "")}
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
                <ResultsPanel
                  activeTab={resultTab}
                  details={selectedObject}
                  queryResult={queryResult}
                  queryState={queryState}
                  onClose={() => setResultsOpen(false)}
                  onCopy={copyResult}
                  onExport={exportCsv}
                  onTabChange={setResultTab}
                />
              ) : null}
            </>
          )}
        </main>
        {requiresConnection ? null : (
          <ObjectDetails
            details={selectedObject}
            onCopyName={copyObjectName}
            onLoadDdl={loadDdl}
            onPreview={() => previewObject()}
            onRefresh={refreshAll}
          />
        )}
      </div>
      <StatusBar
        activeConnection={activeConnection}
        queryState={queryState}
        statusText={statusText}
        toast={toast}
      />
      {connectionDialogOpen ? (
        <ConnectionDialog
          initialDraft={dialogInitialDraft}
          onClose={() => setConnectionDialogOpen(false)}
          onSave={saveConnection}
        />
      ) : null}
      {passwordConnection ? (
        <PasswordConnectionDialog
          connection={passwordConnection}
          onClose={() => setPasswordConnection(null)}
          onConnect={connectStoredConnection}
        />
      ) : null}
      {deleteConnectionRequest ? (
        <DeleteConnectionDialog
          connection={deleteConnectionRequest}
          onCancel={() => setDeleteConnectionRequest(null)}
          onConfirm={confirmDeleteConnection}
        />
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
      </div>
      <button
        onClick={onNewConnection}
        className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.15)] hover:brightness-110"
      >
        <Plus size={14} />
        Connection
      </button>
    </header>
  );
}

function Explorer({
  activeConnection,
  nodes,
  storedConnections,
  collapsedNodes,
  refreshing,
  selectedObjectId,
  onConnectSaved,
  onDeleteSaved,
  onToggleNode,
  onSelectObject,
  onNewConnection,
  onRefresh,
}: {
  activeConnection: ConnectionProfile | null;
  nodes: DatabaseTreeNode[];
  storedConnections: StoredConnectionDraft[];
  collapsedNodes: Set<string>;
  refreshing: boolean;
  selectedObjectId: string;
  onConnectSaved: (nodeId: string) => void;
  onDeleteSaved: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onSelectObject: (objectId: string) => void;
  onNewConnection: () => void;
  onRefresh: () => void;
}) {
  const stats = useMemo(() => getExplorerStats(nodes), [nodes]);

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
          <IconButton title="Refresh" onClick={onRefresh}>
            <RefreshCw size={14} className={cn(refreshing && "animate-spin text-primary")} />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <MetricMini value={String(stats.tables)} label="tables" />
        <MetricMini value={String(stats.schemas)} label="schemas" />
        <MetricMini
          value={activeConnection ? `${activeConnection.latencyMs}ms` : "--"}
          label="ping"
          amber
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 py-2">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            collapsedNodes={collapsedNodes}
            depth={0}
            node={node}
            rootNodes={nodes}
            activeConnection={activeConnection}
            selectedObjectId={selectedObjectId}
            storedConnections={storedConnections}
            onConnectSaved={onConnectSaved}
            onDeleteSaved={onDeleteSaved}
            onSelectObject={onSelectObject}
            onToggleNode={onToggleNode}
          />
        ))}
      </div>
    </aside>
  );
}

function TreeNode({
  collapsedNodes,
  node,
  rootNodes,
  activeConnection,
  depth,
  selectedObjectId,
  storedConnections,
  onConnectSaved,
  onDeleteSaved,
  onSelectObject,
  onToggleNode,
}: {
  collapsedNodes: Set<string>;
  node: DatabaseTreeNode;
  rootNodes: DatabaseTreeNode[];
  activeConnection: ConnectionProfile | null;
  depth: number;
  selectedObjectId: string;
  storedConnections: StoredConnectionDraft[];
  onConnectSaved: (nodeId: string) => void;
  onDeleteSaved: (nodeId: string) => void;
  onSelectObject: (objectId: string) => void;
  onToggleNode: (nodeId: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const collapsed = collapsedNodes.has(node.id) || node.open === false;
  const selectable = node.kind === "table" || node.kind === "view";
  const savedConnection = isSavedConnectionNodeId(node.id);
  const deletableConnection = findStoredConnectionForNode(node, rootNodes, storedConnections);
  const activeDatabase =
    Boolean(deletableConnection) &&
    Boolean(activeConnection) &&
    activeConnection?.host === deletableConnection?.host &&
    activeConnection?.port === deletableConnection?.port &&
    activeConnection?.database === deletableConnection?.database &&
    activeConnection?.user === deletableConnection?.user;
  const selected = node.id === selectedObjectId;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) onToggleNode(node.id);
          if (selectable) onSelectObject(node.id);
          if (savedConnection) onConnectSaved(node.id);
        }}
        className={cn(
          "group flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          selected &&
            "border border-primary/25 bg-[hsl(var(--primary)/0.12)] text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]",
        )}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
      >
        {hasChildren ? (
          collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <TreeIcon
          kind={node.kind}
          className={cn(selected ? "text-primary" : "text-muted-foreground")}
        />
        <span className="truncate">{node.label}</span>
        {node.id.startsWith("connection:") ? (
          <Circle size={7} className="ml-auto fill-emerald-400 text-emerald-400" />
        ) : deletableConnection ? (
          <span className="ml-auto flex items-center gap-1">
            <span
              title={activeDatabase ? "Active connection" : "Inactive connection"}
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                activeDatabase
                  ? "border-emerald-300/80 bg-emerald-400 shadow-[0_0_10px_hsl(142_76%_55%/0.45)]"
                  : "border-amber-300/70 bg-amber-300/75 shadow-[0_0_6px_hsl(43_96%_56%/0.16)]",
              )}
            />
            <span
              role="button"
              tabIndex={0}
              title="Delete connection"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteSaved(
                  savedConnection ? node.id : savedConnectionNodeId(deletableConnection),
                );
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onDeleteSaved(
                  savedConnection ? node.id : savedConnectionNodeId(deletableConnection),
                );
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus:bg-muted focus:text-destructive"
            >
              <Trash2 size={12} />
            </span>
          </span>
        ) : null}
      </button>
      {!collapsed && hasChildren ? (
        <div>
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              collapsedNodes={collapsedNodes}
              depth={depth + 1}
              node={child}
              rootNodes={rootNodes}
              activeConnection={activeConnection}
              selectedObjectId={selectedObjectId}
              storedConnections={storedConnections}
              onConnectSaved={onConnectSaved}
              onDeleteSaved={onDeleteSaved}
              onSelectObject={onSelectObject}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreeIcon({ kind, className }: { kind: DatabaseObjectKind; className: string }) {
  if (kind === "schema") return <Folder size={14} className={className} />;
  if (kind === "view") return <Braces size={14} className={className} />;
  if (kind === "table") return <Table2 size={14} className={className} />;
  return <Database size={14} className={className} />;
}

function EditorTabs({
  tabs,
  activeTabId,
  onSelect,
  onNewTab,
}: {
  tabs: SqlTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onNewTab: () => void;
}) {
  return (
    <div className="chrome-panel flex h-9 shrink-0 items-end border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            "flex h-9 max-w-56 items-center gap-2 border-r border-border px-3 text-[12.5px]",
            activeTabId === tab.id
              ? "bg-background shadow-[inset_0_2px_0_hsl(var(--primary))]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <FileCode2 size={14} className={cn(activeTabId === tab.id && "text-primary")} />
          <span className="truncate">{tab.label}</span>
          {tab.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </button>
      ))}
      <button
        className="ml-1 flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        title="New SQL tab"
        onClick={onNewTab}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function EmptyWorkspace({
  hasStoredConnections,
  onNewConnection,
}: {
  hasStoredConnections: boolean;
  onNewConnection: () => void;
}) {
  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[hsl(220_13%_8%)] px-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.28)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />
      <div className="relative grid max-w-[520px] justify-items-center gap-5 text-center">
        {hasStoredConnections ? <SavedConnectionEmptySvg /> : <NoConnectionEmptySvg />}
        <div className="grid gap-2">
          <h2 className="text-[18px] font-semibold text-foreground">
            {hasStoredConnections ? "No active database connection" : "No connections yet"}
          </h2>
          <p className="max-w-[460px] text-[13px] leading-6 text-muted-foreground">
            {hasStoredConnections
              ? "Select a saved database from the explorer and enter its password to unlock the workspace."
              : "Add a PostgreSQL connection to inspect schemas, tables, views, columns, and indexes."}
          </p>
        </div>
        <button
          onClick={onNewConnection}
          className="flex h-9 items-center gap-2 rounded bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.16)] hover:brightness-110"
        >
          <Plus size={15} />
          Connection
        </button>
      </div>
    </section>
  );
}

function NoConnectionEmptySvg() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 136"
      className="h-28 w-40 text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.16)]"
    >
      <rect
        x="34"
        y="22"
        width="112"
        height="76"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M52 44h76M52 62h52M52 80h64"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 116h64M74 98l-10 18M106 98l10 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="137"
        cy="31"
        r="15"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M131 31h12M137 25v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SavedConnectionEmptySvg() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 136"
      className="h-28 w-40 text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.16)]"
    >
      <rect
        x="28"
        y="26"
        width="52"
        height="70"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="100"
        y="26"
        width="52"
        height="70"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M80 61h20"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <circle cx="54" cy="48" r="5" fill="currentColor" />
      <circle cx="126" cy="48" r="5" fill="currentColor" />
      <path
        d="M46 70h16M118 70h16M46 82h22M118 82h22"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M78 111c10-14 14-14 24 0 10 14 14 14 24 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="90"
        cy="111"
        r="4"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="114"
        cy="111"
        r="4"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function QueryToolbar({
  onCycleLimit,
  onCycleSchema,
  onRun,
  onStop,
  queryState,
  rowLimit,
  schema,
}: {
  onCycleLimit: () => void;
  onCycleSchema: () => void;
  onRun: () => void;
  onStop: () => void;
  queryState: QueryState;
  rowLimit: number;
  schema: string;
}) {
  return (
    <div className="chrome-panel flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onRun}
          disabled={queryState === "running"}
          className="flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.14)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {queryState === "running" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          Run
        </button>
        <IconButton title="Stop query" onClick={onStop} disabled={queryState !== "running"}>
          <Square size={13} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <button
          onClick={onCycleLimit}
          className="control flex h-7 items-center gap-1.5 rounded px-2 text-[12px]"
        >
          Limit {rowLimit}
          <ChevronDown size={13} />
        </button>
        <button
          onClick={onCycleSchema}
          className="control flex h-7 items-center gap-1.5 rounded px-2 text-[12px]"
        >
          {schema}
          <ChevronDown size={13} />
        </button>
      </div>
      <div className="pr-2 text-[12px] text-muted-foreground">PostgreSQL metadata</div>
    </div>
  );
}

function ResultsPanel({
  activeTab,
  details,
  queryResult,
  queryState,
  onClose,
  onCopy,
  onExport,
  onTabChange,
}: {
  activeTab: ResultPanelTab;
  details: DatabaseObjectDetails | null;
  queryResult: QueryResult | null;
  queryState: QueryState;
  onClose: () => void;
  onCopy: () => void;
  onExport: () => void;
  onTabChange: (tab: ResultPanelTab) => void;
}) {
  const tabs = [
    { id: "results" as const, label: "Results", icon: Table2 },
    { id: "columns" as const, label: "Columns", icon: Columns3 },
  ];

  return (
    <section className="chrome-panel flex h-[280px] shrink-0 flex-col border-t border-border">
      <div className="flex h-9 items-center justify-between border-b border-border">
        <div className="flex h-full items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex h-full items-center gap-1.5 border-r border-border px-3 text-[12px]",
                  activeTab === tab.id
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={14} className={cn(activeTab === tab.id && "text-primary")} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 pr-2">
          <IconButton title="Copy" onClick={onCopy}>
            <Copy size={14} />
          </IconButton>
          <IconButton title="Export CSV" onClick={onExport}>
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
        ) : activeTab === "results" ? (
          <DataGrid queryResult={queryResult} />
        ) : activeTab === "columns" ? (
          <ColumnsView details={details} />
        ) : (
          <DataGrid queryResult={queryResult} />
        )}
      </div>
    </section>
  );
}

function DataGrid({ queryResult }: { queryResult: QueryResult | null }) {
  if (!queryResult) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
        SQL execution is not enabled yet.
      </div>
    );
  }

  return (
    <table className="db-grid w-full border-collapse font-mono text-[12px]">
      <thead className="sticky top-0 bg-[hsl(var(--panel-soft))]">
        <tr>
          <th className="w-10 border-b border-r border-border px-2 py-1.5 text-right font-normal text-muted-foreground">
            #
          </th>
          {queryResult.columns.map((column) => (
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
        {queryResult.rows.map((row, index) => (
          <tr key={`${row[0]}-${index}`} className="hover:bg-[hsl(var(--primary)/0.08)]">
            <td className="border-b border-r border-border px-2 py-1.5 text-right text-muted-foreground">
              {index + 1}
            </td>
            {row.map((cell, cellIndex) => (
              <td
                key={`${cell}-${cellIndex}`}
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

function ColumnsView({ details }: { details: DatabaseObjectDetails | null }) {
  if (!details) return <EmptyPanel text="Select an object to inspect columns." />;
  return (
    <div className="p-3">
      {details.columns.map((column) => (
        <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
      ))}
    </div>
  );
}

function ObjectDetails({
  details,
  onCopyName,
  onLoadDdl,
  onPreview,
  onRefresh,
}: {
  details: DatabaseObjectDetails | null;
  onCopyName: () => void;
  onLoadDdl: () => void;
  onPreview: () => void;
  onRefresh: () => void;
}) {
  if (!details) {
    return (
      <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
        <EmptyPanel text="Loading object details" />
      </aside>
    );
  }

  const objectLabel = `${details.schema}.${details.name}`;
  const objectKindLabel = details.kind === "view" ? "View" : "Table";

  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-primary/25 bg-primary/10">
            {details.kind === "view" ? (
              <Braces size={17} className="text-primary" />
            ) : (
              <Table2 size={17} className="text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{objectLabel}</div>
            <div className="text-[12px] text-muted-foreground">
              {objectKindLabel} - {details.engine}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <MetricMini value={String(details.columns.length)} label="cols" />
        <MetricMini value={String(details.indexes.length)} label="indexes" />
        <MetricMini value={details.safeEdit ? "PK" : "RO"} label="safe edit" amber />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <SectionTitle>Columns</SectionTitle>
        {details.columns.map((column) => (
          <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
        ))}

        <SectionTitle className="mt-5">Indexes</SectionTitle>
        {details.indexes.length > 0 ? (
          details.indexes.map((index) => (
            <DetailRow key={index.name} name={index.name} value={formatIndex(index)} />
          ))
        ) : (
          <div className="text-[12px] text-muted-foreground">No indexes for this object</div>
        )}

        <SectionTitle className="mt-5">Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <SmallAction icon={Table2} label="Preview" onClick={onPreview} />
          <SmallAction icon={FileCode2} label="DDL" onClick={onLoadDdl} />
          <SmallAction icon={RefreshCw} label="Refresh" onClick={onRefresh} />
          <SmallAction icon={Copy} label="Copy name" onClick={onCopyName} />
        </div>
      </div>
    </aside>
  );
}

function ConnectionDialog({
  initialDraft,
  onClose,
  onSave,
}: {
  initialDraft: StoredConnectionDraft | null;
  onClose: () => void;
  onSave: (draft: ConnectionDraft) => Promise<void>;
}) {
  const defaultDraft: ConnectionDraft = {
    name: "Local PostgreSQL",
    host: "localhost",
    port: 5432,
    database: "databara_dev",
    user: "postgres",
    password: "",
    sslMode: "Prefer",
  };
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConnectionDraft>({
    ...defaultDraft,
    ...initialDraft,
  });

  function updateDraft(key: keyof ConnectionDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: key === "port" ? Number(value) : value,
    }));
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testPostgresConnection({
        ...draft,
        name: connectionDisplayName(draft),
      });
      setTestResult(result.message);
    } catch (error) {
      setTestResult(readErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    setSaving(true);
    setTestResult(null);
    await onSave({ ...draft, name: connectionDisplayName(draft) });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="chrome-panel hairline w-full max-w-[540px] rounded border border-border shadow-2xl">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound size={16} className="text-primary" />
            PostgreSQL connection
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          <Field label="Host" value={draft.host} onChange={(value) => updateDraft("host", value)} />
          <Field
            label="Port"
            value={String(draft.port)}
            onChange={(value) => updateDraft("port", value)}
          />
          <Field
            label="Database"
            value={draft.database}
            onChange={(value) => updateDraft("database", value)}
          />
          <Field label="User" value={draft.user} onChange={(value) => updateDraft("user", value)} />
          <Field
            label="Password"
            value={draft.password}
            onChange={(value) => updateDraft("password", value)}
            type="password"
          />
          <label className="grid gap-1.5 text-[12px] text-muted-foreground">
            SSL mode
            <select
              value={draft.sslMode}
              onChange={(event) => updateDraft("sslMode", event.target.value)}
              className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary"
            >
              <option>Prefer</option>
              <option>Require</option>
              <option>Disable</option>
            </select>
          </label>
          <div className="col-span-2 min-h-6 text-[12px]">
            {testResult ? (
              <span className="text-emerald-300">{testResult}</span>
            ) : (
              <span className="text-muted-foreground">
                Password is used for this session only and is not saved.
              </span>
            )}
          </div>
        </div>
        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
          <button
            onClick={testConnection}
            disabled={testing || saving}
            className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Test connection
          </button>
          <button
            onClick={saveConnection}
            disabled={testing || saving}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordConnectionDialog({
  connection,
  onClose,
  onConnect,
}: {
  connection: StoredConnectionDraft;
  onClose: () => void;
  onConnect: (connection: StoredConnectionDraft, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      await onConnect(connection, password);
    } catch (connectError) {
      setError(readErrorMessage(connectError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="chrome-panel hairline w-full max-w-[420px] rounded border border-border shadow-2xl">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            <KeyRound size={16} className="shrink-0 text-primary" />
            <span className="truncate">Connect to {connection.database}</span>
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid gap-3 p-4">
          <div className="grid gap-1 text-[12px] text-muted-foreground">
            <div className="truncate font-mono text-foreground">
              {connection.user}@{connection.host}:{connection.port}
            </div>
            <div>Enter the password for this session.</div>
          </div>
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            className="col-span-1"
          />
          <div className="min-h-5 text-[12px]">
            {error ? <span className="text-destructive">{error}</span> : null}
          </div>
        </div>
        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
          <button onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button
            onClick={connect}
            disabled={saving}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConnectionDialog({
  connection,
  onCancel,
  onConfirm,
}: {
  connection: StoredConnectionDraft;
  onCancel: () => void;
  onConfirm: (connection: StoredConnectionDraft) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="chrome-panel hairline w-full max-w-[420px] rounded border border-border shadow-2xl">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            <Trash2 size={16} className="shrink-0 text-destructive" />
            <span className="truncate">Delete connection</span>
          </div>
          <IconButton title="Close" onClick={onCancel}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid gap-3 p-4 text-[12px] text-muted-foreground">
          <div>
            Delete the saved connection for{" "}
            <span className="font-mono text-foreground">{connection.database}</span>?
          </div>
          <div className="truncate font-mono text-foreground">
            {connection.user}@{connection.host}:{connection.port}
          </div>
          <div>This removes the saved profile from this device.</div>
        </div>
        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
          <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(connection)}
            className="flex h-8 items-center gap-1.5 rounded bg-destructive px-3 text-[12px] font-semibold text-destructive-foreground hover:brightness-110"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  activeConnection,
  statusText,
  queryState,
  toast,
}: {
  activeConnection: ConnectionProfile | null;
  statusText: string;
  queryState: QueryState;
  toast: Toast;
}) {
  return (
    <footer className="chrome-panel flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-[12px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Circle size={7} className="fill-emerald-400 text-emerald-400" />
          {activeConnection
            ? `${activeConnection.engine} ${activeConnection.engineVersion}`
            : "PostgreSQL"}
        </span>
        <span>{activeConnection?.database ?? "No database connected"}</span>
        <span>{activeConnection?.defaultSchema ?? "--"}</span>
      </div>
      {statusText ? (
        <div
          className={cn(
            "flex items-center gap-1.5",
            queryState === "success" && "text-emerald-300",
            queryState === "error" && "text-destructive",
            toast.tone === "warning" && "text-amber-300",
          )}
        >
          {queryState === "running" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Activity size={13} />
          )}
          {statusText}
        </div>
      ) : null}
    </footer>
  );
}

function MetricMini({ amber, label, value }: { amber?: boolean; label: string; value: string }) {
  return (
    <div className="bg-[hsl(var(--panel))] px-2 py-2">
      <div className={cn("font-mono text-foreground", amber && "text-amber-300")}>{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-[12px] text-muted-foreground">
      {text}
    </div>
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

function Field({
  className,
  label,
  onChange,
  type = "text",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-[12px] text-muted-foreground", className)}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary"
      />
    </label>
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

function SmallAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="control flex h-8 items-center gap-1.5 rounded px-2 text-[12px]"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function IconButton({
  active,
  children,
  className,
  disabled,
  title,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35",
        active && "bg-[hsl(var(--primary)/0.14)] text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
