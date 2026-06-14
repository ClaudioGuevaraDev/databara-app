import Editor from "@monaco-editor/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Activity,
  Braces,
  ChevronDown,
  ChevronLeft,
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
  Save,
  Square,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import {
  connectPostgres,
  closeMainWindowAfterUnsavedResolution,
  deleteStoredConnection,
  getPostgresObjectDetails,
  listPostgresTree,
  loadStoredConnections,
  saveStoredConnection,
  setUnsavedSqlTabs,
  testPostgresConnection,
  type StoredConnectionDraft,
} from "./databaraService";
import { exportQueryResultCsv } from "./mockDatabaraService";
import {
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
type ConnectionFormDraft = Omit<ConnectionDraft, "port"> & { port: string };
type PersistedSqlTabs = {
  activeTabId: string;
  tabs: SqlTab[];
};

const rowLimits = [25, 50, 100, 500];
const schemas = ["public", "analytics"];
const sqlTabsStoragePrefix = "databara.sqlTabs.v1";

function serverNodeId(host: string, port: number) {
  return `server:${host}:${port}`;
}

function savedConnectionNodeId(connection: StoredConnectionDraft) {
  return `saved-connection:${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

function activeDatabaseNodeId(connection: StoredConnectionDraft) {
  return `database:${connection.database}`;
}

function connectionKey(connection: Pick<ConnectionDraft, "host" | "port" | "database" | "user">) {
  return `${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

function sqlTabsStorageKey(
  connection: Pick<ConnectionDraft, "host" | "port" | "database" | "user">,
) {
  return `${sqlTabsStoragePrefix}:${connectionKey(connection)}`;
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

function parseDatabaseObjectId(objectId: string) {
  const [, qualifiedName] = objectId.split(":");
  const [schemaName, objectName] = qualifiedName?.split(".") ?? [];

  if (!schemaName || !objectName) return null;

  return {
    schemaName,
    objectName,
    qualifiedName: `${schemaName}.${objectName}`,
  };
}

function buildDefaultObjectSql(objectId: string, limit: number) {
  const object = parseDatabaseObjectId(objectId);
  return object
    ? `select * from ${object.qualifiedName} limit ${limit};`
    : `select * limit ${limit};`;
}

function buildObjectTabLabel(objectId: string) {
  return parseDatabaseObjectId(objectId)?.qualifiedName ?? objectId;
}

function normalizePersistedSqlTab(tab: unknown, fallbackConnectionKey: string): SqlTab | null {
  if (!tab || typeof tab !== "object") return null;

  const candidate = tab as Partial<SqlTab>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.sql !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    label: candidate.label,
    sql: candidate.sql,
    savedSql: candidate.sql,
    dirty: false,
    state: "official",
    objectId: typeof candidate.objectId === "string" ? candidate.objectId : undefined,
    connectionKey:
      typeof candidate.connectionKey === "string" ? candidate.connectionKey : fallbackConnectionKey,
  };
}

function loadSqlTabsForConnection(
  connection: Pick<ConnectionDraft, "host" | "port" | "database" | "user">,
): PersistedSqlTabs {
  const storageKey = sqlTabsStorageKey(connection);
  const rawTabs = window.localStorage.getItem(storageKey);
  if (!rawTabs) return { tabs: [], activeTabId: "" };

  try {
    const parsed = JSON.parse(rawTabs) as Partial<PersistedSqlTabs>;
    const fallbackConnectionKey = connectionKey(connection);
    const tabs = Array.isArray(parsed.tabs)
      ? parsed.tabs.flatMap((tab) => {
          const normalized = normalizePersistedSqlTab(tab, fallbackConnectionKey);
          return normalized ? [normalized] : [];
        })
      : [];
    const activeTabId =
      typeof parsed.activeTabId === "string" && tabs.some((tab) => tab.id === parsed.activeTabId)
        ? parsed.activeTabId
        : (tabs[0]?.id ?? "");

    return { tabs, activeTabId };
  } catch {
    window.localStorage.removeItem(storageKey);
    return { tabs: [], activeTabId: "" };
  }
}

function saveSqlTabsForConnection(
  connection: Pick<ConnectionDraft, "host" | "port" | "database" | "user">,
  tabs: SqlTab[],
  activeTabId: string,
) {
  const officialTabs = tabs
    .filter((tab) => tab.state === "official")
    .map((tab) => ({
      ...tab,
      sql: tab.savedSql ?? tab.sql,
      dirty: false,
      savedSql: undefined,
    }));
  const persistedTabs: PersistedSqlTabs = {
    tabs: officialTabs,
    activeTabId: officialTabs.some((tab) => tab.id === activeTabId) ? activeTabId : "",
  };

  window.localStorage.setItem(sqlTabsStorageKey(connection), JSON.stringify(persistedTabs));
}

function getTabSelectionState(tab: SqlTab | null) {
  return {
    selectedObjectId: tab?.objectId ?? "",
    clearObjectDetails: !tab?.objectId,
  };
}

function buildConnectionDraft(formDraft: ConnectionFormDraft): ConnectionDraft {
  const host = formDraft.host.trim();
  const port = formDraft.port.trim();
  const database = formDraft.database.trim();
  const user = formDraft.user.trim();

  if (!host || !port || !database || !user) {
    throw new Error("Host, port, database, and user are required.");
  }

  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("Port must be a valid positive number.");
  }

  return {
    ...formDraft,
    host,
    port: parsedPort,
    database,
    user,
    password: formDraft.password,
  };
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
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [loadedSqlTabsKey, setLoadedSqlTabsKey] = useState("");
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [queryResult] = useState<QueryResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultPanelTab>("results");
  const [resultsOpen, setResultsOpen] = useState(true);
  const [rowLimit, setRowLimit] = useState(100);
  const [schema, setSchema] = useState("public");
  const [closeWithUnsavedDialogOpen, setCloseWithUnsavedDialogOpen] = useState(false);
  const [, setToast] = useState<Toast>(() => ({
    text: "Ready",
  }));
  const [refreshing, setRefreshing] = useState(false);
  const runTokenRef = useRef(0);
  const allowWindowCloseRef = useRef(false);
  const hasUnsavedTabsRef = useRef(false);

  const activeConnection = connections[0] ?? null;
  const requiresConnection = connections.length === 0;
  const activeTab = sqlTabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasUnsavedTabs = sqlTabs.some((tab) => tab.state === "official" && tab.dirty);
  const activeConnectionSqlTabsKey = activeConnection ? sqlTabsStorageKey(activeConnection) : "";
  const activeConnectionKey = activeConnection ? connectionKey(activeConnection) : "";
  const hasStoredConnections = storedConnections.length > 0;
  const explorerTree = useMemo(
    () => buildStoredConnectionTree(storedConnections, activeExplorerTree),
    [activeExplorerTree, storedConnections],
  );
  const connectedConnectionKeys = useMemo(
    () => new Set(connections.map((connection) => connectionKey(connection))),
    [connections],
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

  useEffect(() => {
    hasUnsavedTabsRef.current = hasUnsavedTabs;
    if (!("__TAURI_INTERNALS__" in window)) return;

    void setUnsavedSqlTabs(hasUnsavedTabs).catch((error) => {
      notify(readErrorMessage(error), "warning");
    });
  }, [hasUnsavedTabs]);

  useEffect(() => {
    if (!activeConnection || loadedSqlTabsKey !== activeConnectionSqlTabsKey) return;
    saveSqlTabsForConnection(activeConnection, sqlTabs, activeTabId);
  }, [activeConnection, activeConnectionSqlTabsKey, activeTabId, loadedSqlTabsKey, sqlTabs]);

  useEffect(() => {
    function handleUnsavedTabsCloseRequest() {
      setCloseWithUnsavedDialogOpen(true);
    }

    window.addEventListener("databara-unsaved-tabs-close-requested", handleUnsavedTabsCloseRequest);
    return () => {
      window.removeEventListener(
        "databara-unsaved-tabs-close-requested",
        handleUnsavedTabsCloseRequest,
      );
    };
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (allowWindowCloseRef.current) {
          allowWindowCloseRef.current = false;
          return;
        }

        if (!hasUnsavedTabsRef.current) return;

        event.preventDefault();
        if (!cancelled) setCloseWithUnsavedDialogOpen(true);
      })
      .then((dispose) => {
        if (cancelled) dispose();
        else unlisten = dispose;
      })
      .catch((error) => {
        if (!cancelled) notify(readErrorMessage(error), "warning");
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  function notify(text: string, tone: Toast["tone"] = "default") {
    setToast({ text, tone });
  }

  function syncExplorerSelectionWithTab(tab: SqlTab | null) {
    const nextSelection = getTabSelectionState(tab);
    setSelectedObjectId(nextSelection.selectedObjectId);
    if (nextSelection.clearObjectDetails || selectedObject?.id !== nextSelection.selectedObjectId) {
      setSelectedObject(null);
    }
  }

  function updateActiveSql(sql: string) {
    if (!activeTabId) return;

    setSqlTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              sql,
              dirty: sql !== (tab.savedSql ?? tab.sql),
            }
          : tab,
      ),
    );
  }

  function createSqlTab(sql = "select now();") {
    const tab: SqlTab = {
      id: `tab:scratch-${Date.now()}`,
      label: `scratch ${sqlTabs.length + 1}`,
      sql,
      savedSql: sql,
      dirty: false,
      state: "official",
      connectionKey: activeConnectionKey,
    };
    setSqlTabs((tabs) => [...tabs, tab]);
    setActiveTabId(tab.id);
    syncExplorerSelectionWithTab(tab);
    notify("New SQL tab created");
  }

  function openTemporaryObjectTab(objectId: string) {
    if (!activeConnection) return;

    const tab: SqlTab = {
      id: `tab:preview:${activeConnectionKey}`,
      label: buildObjectTabLabel(objectId),
      sql: buildDefaultObjectSql(objectId, rowLimit),
      savedSql: buildDefaultObjectSql(objectId, rowLimit),
      dirty: false,
      state: "temporary",
      objectId,
      connectionKey: activeConnectionKey,
    };

    setSqlTabs((tabs) => {
      const temporaryTabIndex = tabs.findIndex((currentTab) => currentTab.state === "temporary");
      if (temporaryTabIndex === -1) return [...tabs, tab];

      return tabs.map((currentTab, index) => (index === temporaryTabIndex ? tab : currentTab));
    });
    setActiveTabId(tab.id);
  }

  function makeObjectTabOfficial(objectId: string) {
    if (!activeConnection) return;

    const label = buildObjectTabLabel(objectId);
    const sql = buildDefaultObjectSql(objectId, rowLimit);
    const officialTabId = `tab:object:${activeConnectionKey}:${objectId}`;
    const existingOfficialTab = sqlTabs.find(
      (tab) => tab.state === "official" && tab.objectId === objectId,
    );

    if (existingOfficialTab) {
      setActiveTabId(existingOfficialTab.id);
      return;
    }

    setSqlTabs((tabs) => {
      const temporaryTab = tabs.find(
        (tab) => tab.state === "temporary" && tab.objectId === objectId,
      );
      if (temporaryTab) {
        const officialTab = {
          ...temporaryTab,
          id: officialTabId,
          state: "official" as const,
        };
        return tabs.map((tab) => (tab.id === temporaryTab.id ? officialTab : tab));
      }

      const officialTab: SqlTab = {
        id: officialTabId,
        label,
        sql,
        savedSql: sql,
        dirty: false,
        state: "official",
        objectId,
        connectionKey: activeConnectionKey,
      };
      return [...tabs, officialTab];
    });
    setActiveTabId(officialTabId);
  }

  function selectObject(objectId: string) {
    setSelectedObjectId(objectId);
    openTemporaryObjectTab(objectId);
  }

  function confirmObjectTab(objectId: string) {
    setSelectedObjectId(objectId);
    makeObjectTabOfficial(objectId);
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

  const persistTabs = useCallback(
    (nextTabs: SqlTab[], nextActiveTabId: string) => {
      if (!activeConnection) return;
      saveSqlTabsForConnection(activeConnection, nextTabs, nextActiveTabId);
    },
    [activeConnection],
  );

  const saveActiveSqlTab = useCallback(async () => {
    if (!activeTab) return;

    if (activeTab.state !== "official") {
      notify("Officialize the tab before saving", "warning");
      return;
    }

    const nextTabs = sqlTabs.map((tab) =>
      tab.id === activeTab.id ? { ...tab, savedSql: tab.sql, dirty: false } : tab,
    );
    setSqlTabs(nextTabs);
    persistTabs(nextTabs, activeTabId);
    notify(`${activeTab.label} saved`, "success");
  }, [activeTab, activeTabId, persistTabs, sqlTabs]);

  const saveDirtySqlTabs = useCallback(async () => {
    const dirtyTabs = sqlTabs.filter((tab) => tab.state === "official" && tab.dirty);
    if (dirtyTabs.length === 0) return;

    const nextTabs = sqlTabs.map((tab) =>
      tab.state === "official" && tab.dirty ? { ...tab, savedSql: tab.sql, dirty: false } : tab,
    );
    setSqlTabs(nextTabs);
    persistTabs(nextTabs, activeTabId);
    notify(`${dirtyTabs.length} tab${dirtyTabs.length === 1 ? "" : "s"} saved`, "success");
  }, [activeTabId, persistTabs, sqlTabs]);

  function loadConnectionSqlTabs(connection: ConnectionProfile) {
    const savedTabs = loadSqlTabsForConnection(connection);
    const activeTab = savedTabs.tabs.find((tab) => tab.id === savedTabs.activeTabId) ?? null;
    setSqlTabs(savedTabs.tabs);
    setActiveTabId(savedTabs.activeTabId);
    setLoadedSqlTabsKey(sqlTabsStorageKey(connection));
    syncExplorerSelectionWithTab(activeTab);
  }

  function clearConnectionSqlTabs() {
    setSqlTabs([]);
    setActiveTabId("");
    setLoadedSqlTabsKey("");
    syncExplorerSelectionWithTab(null);
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
    loadConnectionSqlTabs(result.connection);
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

  function selectSqlTab(tabId: string) {
    const tab = sqlTabs.find((item) => item.id === tabId) ?? null;
    setActiveTabId(tabId);
    syncExplorerSelectionWithTab(tab);
  }

  function closeSqlTab(tabId: string) {
    const closingTabIndex = sqlTabs.findIndex((tab) => tab.id === tabId);
    if (closingTabIndex === -1) return;

    const nextTabs = sqlTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTab =
      tabId === activeTabId
        ? (nextTabs[closingTabIndex - 1] ?? nextTabs[closingTabIndex] ?? null)
        : (nextTabs.find((tab) => tab.id === activeTabId) ?? null);

    setSqlTabs(nextTabs);
    setActiveTabId(nextActiveTab?.id ?? "");
    syncExplorerSelectionWithTab(nextActiveTab);
    notify(`Closed ${sqlTabs[closingTabIndex]!.label}`);
  }

  const closeWindowAfterResolution = useCallback(
    async (mode: "save" | "discard") => {
      if (mode === "save") {
        await saveDirtySqlTabs();
      }

      setCloseWithUnsavedDialogOpen(false);
      allowWindowCloseRef.current = true;
      await closeMainWindowAfterUnsavedResolution();
    },
    [saveDirtySqlTabs],
  );

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveActiveSqlTab();
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [saveActiveSqlTab]);

  function confirmDeleteConnection(connection: StoredConnectionDraft) {
    const nextStoredConnections = deleteStoredConnection(connection);
    const nextConnections = connections.filter(
      (item) =>
        !(
          item.host === connection.host &&
          item.port === connection.port &&
          item.database === connection.database &&
          item.user === connection.user
        ),
    );

    setStoredConnections(nextStoredConnections);
    setActiveExplorerTree((current) => removeConnectionFromTree(current, connection));
    setConnections(nextConnections);

    if (selectedObjectId && activeConnection?.database === connection.database) {
      setSelectedObjectId("");
      setSelectedObject(null);
    }

    if (activeConnection && connectionKey(activeConnection) === connectionKey(connection)) {
      const nextActiveConnection = nextConnections[0] ?? null;
      if (nextActiveConnection) loadConnectionSqlTabs(nextActiveConnection);
      else clearConnectionSqlTabs();
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
          connectedConnectionKeys={connectedConnectionKeys}
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
          onConfirmObject={confirmObjectTab}
          onSelectObject={selectObject}
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
                onClose={closeSqlTab}
                onSelect={selectSqlTab}
                onNewTab={() => createSqlTab()}
              />
              <QueryToolbar
                canSave={Boolean(activeTab?.state === "official" && activeTab.dirty)}
                queryState={queryState}
                rowLimit={rowLimit}
                schema={schema}
                onRun={() => runQuery()}
                onSave={() => void saveActiveSqlTab()}
                onStop={stopQuery}
                onCycleLimit={cycleLimit}
                onCycleSchema={cycleSchema}
              />
              <section className="min-h-0 flex-1 bg-[hsl(220_13%_8%)]">
                {activeTab ? (
                  <Editor
                    key={activeTab.id}
                    defaultLanguage="sql"
                    value={activeTab.sql}
                    theme="vs-dark"
                    onChange={(value) => updateActiveSql(value ?? "")}
                    onMount={(editor, monaco) => {
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        void saveActiveSqlTab();
                      });
                    }}
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
                ) : (
                  <EmptyEditor />
                )}
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
      <StatusBar activeConnection={activeConnection} />
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
      {closeWithUnsavedDialogOpen ? (
        <UnsavedTabsDialog
          onCancel={() => setCloseWithUnsavedDialogOpen(false)}
          onDiscard={() => void closeWindowAfterResolution("discard")}
          onSave={() => void closeWindowAfterResolution("save")}
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
  connectedConnectionKeys,
  nodes,
  storedConnections,
  collapsedNodes,
  refreshing,
  selectedObjectId,
  onConnectSaved,
  onDeleteSaved,
  onConfirmObject,
  onToggleNode,
  onSelectObject,
  onNewConnection,
  onRefresh,
}: {
  activeConnection: ConnectionProfile | null;
  connectedConnectionKeys: Set<string>;
  nodes: DatabaseTreeNode[];
  storedConnections: StoredConnectionDraft[];
  collapsedNodes: Set<string>;
  refreshing: boolean;
  selectedObjectId: string;
  onConnectSaved: (nodeId: string) => void;
  onDeleteSaved: (nodeId: string) => void;
  onConfirmObject: (objectId: string) => void;
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
            connectedConnectionKeys={connectedConnectionKeys}
            selectedObjectId={selectedObjectId}
            storedConnections={storedConnections}
            onConnectSaved={onConnectSaved}
            onDeleteSaved={onDeleteSaved}
            onConfirmObject={onConfirmObject}
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
  connectedConnectionKeys,
  depth,
  selectedObjectId,
  storedConnections,
  onConnectSaved,
  onDeleteSaved,
  onConfirmObject,
  onSelectObject,
  onToggleNode,
}: {
  collapsedNodes: Set<string>;
  node: DatabaseTreeNode;
  rootNodes: DatabaseTreeNode[];
  connectedConnectionKeys: Set<string>;
  depth: number;
  selectedObjectId: string;
  storedConnections: StoredConnectionDraft[];
  onConnectSaved: (nodeId: string) => void;
  onDeleteSaved: (nodeId: string) => void;
  onConfirmObject: (objectId: string) => void;
  onSelectObject: (objectId: string) => void;
  onToggleNode: (nodeId: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const collapsed = collapsedNodes.has(node.id) || node.open === false;
  const selectable = node.kind === "table" || node.kind === "view";
  const savedConnection = isSavedConnectionNodeId(node.id);
  const deletableConnection = findStoredConnectionForNode(node, rootNodes, storedConnections);
  const connectedDatabase = deletableConnection
    ? connectedConnectionKeys.has(connectionKey(deletableConnection))
    : false;
  const selected = node.id === selectedObjectId;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) onToggleNode(node.id);
          if (selectable) onSelectObject(node.id);
          if (savedConnection) onConnectSaved(node.id);
        }}
        onDoubleClick={() => {
          if (selectable) onConfirmObject(node.id);
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
              title={connectedDatabase ? "Connected" : "Saved connection"}
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                connectedDatabase
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
              connectedConnectionKeys={connectedConnectionKeys}
              selectedObjectId={selectedObjectId}
              storedConnections={storedConnections}
              onConnectSaved={onConnectSaved}
              onDeleteSaved={onDeleteSaved}
              onConfirmObject={onConfirmObject}
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
  onClose,
  onSelect,
  onNewTab,
}: {
  tabs: SqlTab[];
  activeTabId: string;
  onClose: (tabId: string) => void;
  onSelect: (tabId: string) => void;
  onNewTab: () => void;
}) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(viewport.scrollLeft > 0);
    setCanScrollRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }

  function scrollTabs(direction: "left" | "right") {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const activeTabElement = viewport.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    activeTabElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs]);

  return (
    <div className="chrome-panel flex h-9 min-w-0 shrink-0 items-stretch gap-1 border-b border-border px-1">
      <IconButton
        title="Scroll tabs left"
        onClick={() => scrollTabs("left")}
        disabled={!canScrollLeft}
      >
        <ChevronLeft size={15} />
      </IconButton>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          ref={scrollViewportRef}
          onScroll={updateScrollButtons}
          className="flex h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={cn(
                "group flex h-9 max-w-56 shrink-0 items-stretch border-r border-border text-[12.5px] transition-transform",
                activeTabId === tab.id
                  ? "bg-background shadow-[inset_0_2px_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                tab.state === "temporary" && "-skew-x-6 border-r-primary/20 bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 px-3 text-left",
                  tab.state === "temporary" && "skew-x-6",
                )}
              >
                <FileCode2
                  size={14}
                  className={cn(
                    activeTabId === tab.id && "text-primary",
                    tab.state === "temporary" && "opacity-75",
                  )}
                />
                <span className={cn("truncate", tab.state === "temporary" && "italic")}>
                  {tab.label}
                </span>
                {tab.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
              </button>
              <button
                type="button"
                title={`Close ${tab.label}`}
                onClick={() => onClose(tab.id)}
                className={cn(
                  "flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                  activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  tab.state === "temporary" && "skew-x-6",
                )}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <IconButton
        title="Scroll tabs right"
        onClick={() => scrollTabs("right")}
        disabled={!canScrollRight}
      >
        <ChevronRight size={15} />
      </IconButton>
      <button
        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        title="New SQL tab"
        onClick={onNewTab}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
      Select a table or create a SQL tab.
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
  canSave,
  onCycleLimit,
  onCycleSchema,
  onRun,
  onSave,
  onStop,
  queryState,
  rowLimit,
  schema,
}: {
  canSave: boolean;
  onCycleLimit: () => void;
  onCycleSchema: () => void;
  onRun: () => void;
  onSave: () => void;
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
        <button
          onClick={onSave}
          disabled={!canSave}
          className={cn(
            "ml-1 flex h-7 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
            canSave
              ? "bg-emerald-500/14 hover:bg-emerald-500/22 text-emerald-200 shadow-[inset_0_0_0_1px_hsl(160_84%_39%/.36)]"
              : "bg-muted/60 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]",
          )}
          title="Save SQL tab"
        >
          <Save size={14} />
          Save
        </button>
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
        <EmptyPanel text="Select an object to inspect details." />
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
  const defaultDraft: ConnectionFormDraft = {
    name: "",
    host: "",
    port: "",
    database: "",
    user: "",
    password: "",
    sslMode: "Prefer",
  };
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConnectionFormDraft>({
    ...defaultDraft,
    ...(initialDraft
      ? {
          ...initialDraft,
          port: String(initialDraft.port),
        }
      : null),
  });

  function updateDraft(key: keyof ConnectionFormDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function testConnection() {
    setTestResult(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setTestResult(readErrorMessage(error));
      return;
    }

    setTesting(true);
    try {
      const result = await testPostgresConnection({
        ...nextDraft,
        name: connectionDisplayName(nextDraft),
      });
      setTestResult(result.message);
    } catch (error) {
      setTestResult(readErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    setTestResult(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setTestResult(readErrorMessage(error));
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...nextDraft, name: connectionDisplayName(nextDraft) });
    } finally {
      setSaving(false);
    }
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveConnection();
          }}
        >
          <div className="grid grid-cols-2 gap-3 p-4">
            <Field
              label="Host"
              value={draft.host}
              onChange={(value) => updateDraft("host", value)}
              placeholder="localhost"
              autoFocus
            />
            <Field
              label="Port"
              value={draft.port}
              onChange={(value) => updateDraft("port", value)}
              placeholder="5432"
            />
            <Field
              label="Database"
              value={draft.database}
              onChange={(value) => updateDraft("database", value)}
              placeholder="databara_dev"
            />
            <Field
              label="User"
              value={draft.user}
              onChange={(value) => updateDraft("user", value)}
              placeholder="postgres"
            />
            <Field
              label="Password"
              value={draft.password}
              onChange={(value) => updateDraft("password", value)}
              type="password"
              placeholder="Enter password"
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
              type="button"
              onClick={() => void testConnection()}
              disabled={testing || saving}
              className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Test connection
            </button>
            <button
              type="submit"
              disabled={testing || saving}
              className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Connect
            </button>
          </div>
        </form>
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
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
              placeholder="Enter password"
              autoFocus
            />
            <div className="min-h-5 text-[12px]">
              {error ? <span className="text-destructive">{error}</span> : null}
            </div>
          </div>
          <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
            <button
              type="button"
              onClick={onClose}
              className="control h-8 rounded px-3 text-[12px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Connect
            </button>
          </div>
        </form>
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

function UnsavedTabsDialog({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="chrome-panel hairline w-full max-w-[460px] rounded border border-border shadow-2xl">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            <Save size={16} className="shrink-0 text-primary" />
            <span className="truncate">Unsaved tabs</span>
          </div>
          <IconButton title="Close" onClick={onCancel}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid gap-3 p-4 text-[12px] text-muted-foreground">
          <div>There are SQL tabs with unsaved changes.</div>
          <div>Save them before closing the app?</div>
        </div>
        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
          <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button onClick={onDiscard} className="control h-8 rounded px-3 text-[12px]">
            Don't save
          </button>
          <button
            onClick={onSave}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ activeConnection }: { activeConnection: ConnectionProfile | null }) {
  return (
    <footer className="chrome-panel flex h-7 shrink-0 items-center border-t border-border px-3 text-[12px] text-muted-foreground">
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
  autoFocus,
  className,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoFocus?: boolean;
  className?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-[12px] text-muted-foreground", className)}>
      {label}
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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
