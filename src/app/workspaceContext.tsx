import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  closeMainWindowAfterUnsavedResolution,
  connectPostgres,
  deleteStoredConnection,
  getPostgresObjectDetails,
  listPostgresTree,
  loadStoredConnections,
  saveStoredConnection,
  setUnsavedSqlTabs,
  type StoredConnectionDraft,
} from "./databaraService";
import { exportQueryResultCsv } from "./query/exportCsv";
import {
  type ConnectionDraft,
  type ConnectionProfile,
  type DatabaseObjectDetails,
  type DatabaseTreeNode,
  type QueryState,
  type QueryResult,
  type ResultPanelTab,
  type SqlTab,
} from "./types";
import {
  savedConnectionNodeId,
  WorkspaceContext,
  type WorkspaceContextValue,
} from "./workspaceCore";

type Toast = { text: string; tone?: "default" | "success" | "warning" };
type PersistedSqlTabs = {
  activeTabId: string;
  tabs: SqlTab[];
};

const defaultRowLimit = 100;
const sqlTabsStoragePrefix = "databara.sqlTabs.v1";

function serverNodeId(host: string, port: number) {
  return `server:${host}:${port}`;
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

function buildTemporaryObjectTabId(connectionKeyValue: string, objectId: string) {
  return `tab:preview:${connectionKeyValue}:${objectId}:${Date.now()}`;
}

function buildOfficialObjectTabId(connectionKeyValue: string, objectId: string) {
  return `tab:object:${connectionKeyValue}:${objectId}`;
}

function createOfficialSqlTab({
  connectionKey,
  dirty,
  label,
  objectId,
  savedSql,
  sql,
}: {
  connectionKey: string;
  dirty: boolean;
  label: string;
  objectId?: string;
  savedSql?: string;
  sql: string;
}): SqlTab {
  return {
    connectionKey,
    dirty,
    id: objectId ? buildOfficialObjectTabId(connectionKey, objectId) : `tab:sql:${connectionKey}`,
    label,
    objectId,
    savedSql,
    sql,
    state: "official",
  };
}

function officializeSqlTab(
  tabs: SqlTab[],
  tabId: string,
  fallbackConnectionKey: string,
): { activeTabId: string; tabs: SqlTab[] } {
  const targetTab = tabs.find((tab) => tab.id === tabId);
  if (!targetTab) {
    return { activeTabId: tabId, tabs };
  }

  if (targetTab.state === "official") {
    return { activeTabId: targetTab.id, tabs };
  }

  const nextConnectionKey = targetTab.connectionKey ?? fallbackConnectionKey;
  const officialTabId = targetTab.objectId
    ? buildOfficialObjectTabId(nextConnectionKey, targetTab.objectId)
    : targetTab.id;
  const existingOfficialTab = tabs.find(
    (tab) => tab.id !== targetTab.id && tab.state === "official" && tab.id === officialTabId,
  );

  if (existingOfficialTab) {
    const mergedOfficialTab: SqlTab = {
      ...existingOfficialTab,
      connectionKey: nextConnectionKey,
      label: targetTab.label,
      objectId: targetTab.objectId,
      sql: targetTab.sql,
      dirty: targetTab.sql !== (existingOfficialTab.savedSql ?? targetTab.savedSql ?? targetTab.sql),
    };

    return {
      activeTabId: mergedOfficialTab.id,
      tabs: tabs
        .filter((tab) => tab.id !== targetTab.id)
        .map((tab) => (tab.id === existingOfficialTab.id ? mergedOfficialTab : tab)),
    };
  }

  const officialTab: SqlTab = {
    ...targetTab,
    connectionKey: nextConnectionKey,
    id: officialTabId,
    state: "official",
  };

  return {
    activeTabId: officialTab.id,
    tabs: tabs.map((tab) => (tab.id === targetTab.id ? officialTab : tab)),
  };
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
    connectionKey:
      typeof candidate.connectionKey === "string" ? candidate.connectionKey : fallbackConnectionKey,
    dirty: false,
    id: candidate.id,
    label: candidate.label,
    objectId: typeof candidate.objectId === "string" ? candidate.objectId : undefined,
    savedSql: candidate.sql,
    sql: candidate.sql,
    state: "official",
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
      dirty: false,
      savedSql: undefined,
      sql: tab.savedSql ?? tab.sql,
    }));
  const persistedTabs: PersistedSqlTabs = {
    activeTabId: officialTabs.some((tab) => tab.id === activeTabId) ? activeTabId : "",
    tabs: officialTabs,
  };

  window.localStorage.setItem(sqlTabsStorageKey(connection), JSON.stringify(persistedTabs));
}

function getTabSelectionState(tab: SqlTab | null) {
  return {
    clearObjectDetails: !tab?.objectId,
    selectedObjectId: tab?.objectId ?? "",
  };
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
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
  const [queryState] = useState<QueryState>("idle");
  const [queryResult] = useState<QueryResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultPanelTab>("results");
  const [resultsOpen, setResultsOpen] = useState(true);
  const [closeWithUnsavedDialogOpen, setCloseWithUnsavedDialogOpen] = useState(false);
  const [, setToast] = useState<Toast>(() => ({
    text: "Ready",
  }));
  const allowWindowCloseRef = useRef(false);
  const hasUnsavedTabsRef = useRef(false);
  const sqlTabsRef = useRef<SqlTab[]>([]);
  const activeTabIdRef = useRef("");

  const activeConnection = connections[0] ?? null;
  const requiresConnection = connections.length === 0;
  const activeTab = sqlTabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasUnsavedTabs = sqlTabs.some((tab) => tab.dirty);
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

  const notify = useCallback((text: string, tone: Toast["tone"] = "default") => {
    setToast({ text, tone });
  }, []);

  const syncExplorerSelectionWithTab = useCallback(
    (tab: SqlTab | null) => {
      const nextSelection = getTabSelectionState(tab);
      setSelectedObjectId(nextSelection.selectedObjectId);
      if (
        nextSelection.clearObjectDetails ||
        selectedObject?.id !== nextSelection.selectedObjectId
      ) {
        setSelectedObject(null);
      }
    },
    [selectedObject],
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
  }, [activeConnection, notify, requiresConnection, selectedObjectId]);

  useEffect(() => {
    hasUnsavedTabsRef.current = hasUnsavedTabs;
    if (!("__TAURI_INTERNALS__" in window)) return;

    void setUnsavedSqlTabs(hasUnsavedTabs).catch((error) => {
      notify(readErrorMessage(error), "warning");
    });
  }, [hasUnsavedTabs, notify]);

  useEffect(() => {
    sqlTabsRef.current = sqlTabs;
    activeTabIdRef.current = activeTabId;
  }, [activeTabId, sqlTabs]);

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
  }, [notify]);

  const persistTabs = useCallback(
    (nextTabs: SqlTab[], nextActiveTabId: string) => {
      if (!activeConnection) return;
      saveSqlTabsForConnection(activeConnection, nextTabs, nextActiveTabId);
    },
    [activeConnection],
  );

  const commitSqlTab = useCallback(
    (tabId: string) => {
      const currentTabs = sqlTabsRef.current;
      const currentTab = currentTabs.find((tab) => tab.id === tabId);
      if (!currentTab) return null;

      const officialized = officializeSqlTab(currentTabs, currentTab.id, activeConnectionKey);
      const nextActiveTabId = officialized.activeTabId;
      const nextTabs = officialized.tabs.map((tab) =>
        tab.id === nextActiveTabId ? { ...tab, dirty: false, savedSql: tab.sql } : tab,
      );
      const committedTab =
        nextTabs.find((tab) => tab.id === nextActiveTabId) ?? currentTab;

      sqlTabsRef.current = nextTabs;
      activeTabIdRef.current = nextActiveTabId;
      setSqlTabs(nextTabs);
      setActiveTabId(nextActiveTabId);
      persistTabs(nextTabs, nextActiveTabId);

      return committedTab;
    },
    [activeConnectionKey, persistTabs],
  );

  const saveActiveSqlTab = useCallback(async () => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;
    const committedTab = commitSqlTab(currentTabId);
    if (!committedTab) return;
    notify(`${committedTab.label} saved`, "success");
  }, [commitSqlTab, notify]);

  const saveDirtySqlTabs = useCallback(async () => {
    const dirtyTabs = sqlTabsRef.current.filter((tab) => tab.dirty);
    if (dirtyTabs.length === 0) return;

    let lastCommittedTabId = activeTabIdRef.current;

    for (const dirtyTab of dirtyTabs) {
      const committedTab = commitSqlTab(dirtyTab.id);
      if (committedTab) {
        lastCommittedTabId = committedTab.id;
      }
    }

    if (lastCommittedTabId) {
      activeTabIdRef.current = lastCommittedTabId;
      setActiveTabId(lastCommittedTabId);
    }

    notify(`${dirtyTabs.length} tab${dirtyTabs.length === 1 ? "" : "s"} saved`, "success");
  }, [commitSqlTab, notify]);

  const loadConnectionSqlTabs = useCallback(
    (connection: ConnectionProfile) => {
      const savedTabs = loadSqlTabsForConnection(connection);
      const nextActiveTab = savedTabs.tabs.find((tab) => tab.id === savedTabs.activeTabId) ?? null;
      setSqlTabs(savedTabs.tabs);
      setActiveTabId(savedTabs.activeTabId);
      setLoadedSqlTabsKey(sqlTabsStorageKey(connection));
      syncExplorerSelectionWithTab(nextActiveTab);
    },
    [syncExplorerSelectionWithTab],
  );

  const clearConnectionSqlTabs = useCallback(() => {
    setSqlTabs([]);
    setActiveTabId("");
    setLoadedSqlTabsKey("");
    syncExplorerSelectionWithTab(null);
  }, [syncExplorerSelectionWithTab]);

  const connectAndStoreConnection = useCallback(
    async (draft: ConnectionDraft) => {
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
    },
    [loadConnectionSqlTabs, notify],
  );

  const updateActiveSql = useCallback(
    (sql: string) => {
      if (!activeTabId) return;

      setSqlTabs((tabs) => {
        return tabs.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                dirty: sql !== (tab.savedSql ?? tab.sql),
                sql,
              }
            : tab,
        );
      });
    },
    [activeTabId],
  );

  const openTemporaryObjectTab = useCallback(
    (objectId: string) => {
      if (!activeConnection) return;

      const sql = buildDefaultObjectSql(objectId, defaultRowLimit);
      const label = buildObjectTabLabel(objectId);

      setSqlTabs((tabs) => {
        const reusableTemporaryTab = tabs.find(
          (currentTab) =>
            currentTab.state === "temporary" &&
            !currentTab.dirty &&
            currentTab.connectionKey === activeConnectionKey,
        );

        if (reusableTemporaryTab) {
          const nextTab: SqlTab = {
            ...reusableTemporaryTab,
            label,
            objectId,
            savedSql: sql,
            sql,
          };
          setActiveTabId(nextTab.id);
          return tabs.map((currentTab) => (currentTab.id === reusableTemporaryTab.id ? nextTab : currentTab));
        }

        const nextTab: SqlTab = {
          connectionKey: activeConnectionKey,
          dirty: false,
          id: buildTemporaryObjectTabId(activeConnectionKey, objectId),
          label,
          objectId,
          savedSql: sql,
          sql,
          state: "temporary",
        };
        setActiveTabId(nextTab.id);
        return [...tabs, nextTab];
      });
    },
    [activeConnection, activeConnectionKey],
  );

  const makeObjectTabOfficial = useCallback(
    (objectId: string) => {
      if (!activeConnection) return;

      const label = buildObjectTabLabel(objectId);
      const sql = buildDefaultObjectSql(objectId, defaultRowLimit);
      const officialTabId = buildOfficialObjectTabId(activeConnectionKey, objectId);
      const existingOfficialTab = sqlTabs.find(
        (tab) => tab.state === "official" && tab.objectId === objectId,
      );

      if (existingOfficialTab) {
        setActiveTabId(existingOfficialTab.id);
        return;
      }

      setSqlTabs((tabs) => {
        const temporaryTab = tabs.find((tab) => tab.state === "temporary" && tab.objectId === objectId);
        if (temporaryTab) {
          return officializeSqlTab(tabs, temporaryTab.id, activeConnectionKey).tabs;
        }

        const officialTab = createOfficialSqlTab({
          connectionKey: activeConnectionKey,
          dirty: false,
          label,
          objectId,
          savedSql: sql,
          sql,
        });
        return [...tabs, officialTab];
      });
      setActiveTabId(officialTabId);
    },
    [activeConnection, activeConnectionKey, sqlTabs],
  );

  const selectObject = useCallback(
    (objectId: string) => {
      setSelectedObjectId(objectId);
      openTemporaryObjectTab(objectId);
    },
    [openTemporaryObjectTab],
  );

  const confirmObjectTab = useCallback(
    (objectId: string) => {
      setSelectedObjectId(objectId);
      makeObjectTabOfficial(objectId);
    },
    [makeObjectTabOfficial],
  );

  const runQuery = useCallback(() => {
    if (requiresConnection) {
      setDialogInitialDraft(null);
      setConnectionDialogOpen(true);
      notify("Create a connection before running queries", "warning");
      return;
    }

    if (activeTabId) {
      commitSqlTab(activeTabId);
    }

    notify("SQL execution is not enabled yet", "warning");
  }, [activeTabId, commitSqlTab, notify, requiresConnection]);

  const refreshAll = useCallback(async () => {
    if (!activeConnection) {
      notify("Create a connection before refreshing", "warning");
      return;
    }

    try {
      const tree = await listPostgresTree(activeConnection.id);
      setActiveExplorerTree((current) => mergeExplorerTree(current, tree));
      notify("Workspace refreshed", "success");
    } catch (error) {
      notify(readErrorMessage(error), "warning");
    }
  }, [activeConnection, notify]);

  const previewObject = useCallback(
    async (objectId = selectedObjectId) => {
      if (requiresConnection) {
        notify("Create a connection before previewing objects", "warning");
        return;
      }

      void objectId;
      notify("Preview is not enabled until SQL execution is implemented", "warning");
    },
    [notify, requiresConnection, selectedObjectId],
  );

  const loadDdl = useCallback(async () => {
    if (requiresConnection) {
      notify("Create a connection before loading DDL", "warning");
      return;
    }

    notify("DDL generation is not enabled yet", "warning");
  }, [notify, requiresConnection]);

  const copyResult = useCallback(async () => {
    if (!queryResult) {
      notify("Run a query before copying results", "warning");
      return;
    }

    await copyText(
      [queryResult.columns.join("\t"), ...queryResult.rows.map((row) => row.join("\t"))].join("\n"),
    );
    notify("Results copied to clipboard", "success");
  }, [notify, queryResult]);

  const exportCsv = useCallback(() => {
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
  }, [notify, queryResult]);

  const copyObjectName = useCallback(async () => {
    if (!selectedObject) return;
    await copyText(`${selectedObject.schema}.${selectedObject.name}`);
    notify("Object name copied", "success");
  }, [notify, selectedObject]);

  const saveConnection = useCallback(
    async (draft: ConnectionDraft) => {
      try {
        await connectAndStoreConnection(draft);
        setConnectionDialogOpen(false);
      } catch (error) {
        notify(readErrorMessage(error), "warning");
      }
    },
    [connectAndStoreConnection, notify],
  );

  const openNewConnectionDialog = useCallback(() => {
    setDialogInitialDraft(null);
    setConnectionDialogOpen(true);
  }, []);

  const openSavedConnection = useCallback(
    (nodeId: string) => {
      const connection = storedConnections.find((item) => savedConnectionNodeId(item) === nodeId);
      if (!connection) return;

      setPasswordConnection(connection);
      notify(`Enter the password for ${connection.database}`, "warning");
    },
    [notify, storedConnections],
  );

  const connectStoredConnection = useCallback(
    async (connection: StoredConnectionDraft, password: string) => {
      await connectAndStoreConnection({
        ...connection,
        name: connectionDisplayName(connection),
        password,
      });
      setPasswordConnection(null);
    },
    [connectAndStoreConnection],
  );

  const deleteConnection = useCallback(
    (nodeId: string) => {
      const connection = storedConnections.find((item) => savedConnectionNodeId(item) === nodeId);
      if (!connection) return;

      setDeleteConnectionRequest(connection);
    },
    [storedConnections],
  );

  const selectSqlTab = useCallback(
    (tabId: string) => {
      const tab = sqlTabs.find((item) => item.id === tabId) ?? null;
      setActiveTabId(tabId);
      syncExplorerSelectionWithTab(tab);
    },
    [sqlTabs, syncExplorerSelectionWithTab],
  );

  const closeSqlTab = useCallback(
    (tabId: string) => {
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
    },
    [activeTabId, notify, sqlTabs, syncExplorerSelectionWithTab],
  );

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

  const confirmDeleteConnection = useCallback(
    (connection: StoredConnectionDraft) => {
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
    },
    [
      activeConnection,
      clearConnectionSqlTabs,
      connections,
      loadConnectionSqlTabs,
      notify,
      selectedObjectId,
    ],
  );

  const toggleNode = useCallback((nodeId: string) => {
    setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const value: WorkspaceContextValue = {
    actions: {
      closeDeleteConnectionDialog: () => setDeleteConnectionRequest(null),
      closePasswordDialog: () => setPasswordConnection(null),
      closeResults: () => setResultsOpen(false),
      closeSqlTab,
      closeUnsavedTabsDialog: () => setCloseWithUnsavedDialogOpen(false),
      closeWindowAfterResolution,
      confirmDeleteConnection,
      confirmObjectTab,
      connectStoredConnection,
      copyObjectName,
      copyResult,
      deleteConnection,
      exportCsv,
      loadDdl,
      openNewConnectionDialog,
      openSavedConnection,
      previewObject,
      refreshAll,
      runQuery,
      saveActiveSqlTab,
      saveConnection,
      selectObject,
      selectResultTab: setResultTab,
      selectSqlTab,
      setConnectionDialogOpen,
      toggleNode,
      updateActiveSql,
    },
    meta: {
      connectedConnectionKeys,
      explorerTree,
      hasStoredConnections,
      hasUnsavedTabs,
      requiresConnection,
    },
    state: {
      activeConnection,
      activeTab,
      activeTabId,
      collapsedNodes,
      connections,
      deleteConnectionRequest,
      dialogInitialDraft,
      dialogs: {
        connection: connectionDialogOpen,
        unsavedTabs: closeWithUnsavedDialogOpen,
      },
      passwordConnection,
      queryResult,
      queryState,
      resultTab,
      resultsOpen,
      selectedObject,
      selectedObjectId,
      sqlTabs,
      storedConnections,
    },
  };

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
