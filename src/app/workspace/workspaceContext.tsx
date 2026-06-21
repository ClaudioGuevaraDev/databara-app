import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  closeMainWindowAfterUnsavedResolution,
  connectPostgres,
  deleteStoredConnection,
  getPostgresObjectDetails,
  listPostgresTree,
  loadStoredConnections,
  runPostgresQuery,
  saveStoredConnection,
  setUnsavedSqlTabs,
  type StoredConnectionDraft,
} from "../databaraService";
import { exportQueryResultCsv } from "../query/exportCsv";
import { buildObjectSchema } from "../components/results/objectSchema";
import {
  type ConnectionDraft,
  type ConnectionProfile,
  type DatabaseObjectDetails,
  type DatabaseTreeNode,
  type QueryPagination,
  type QueryState,
  type QueryResult,
  type ResultPanelTab,
  type SqlTab,
  type Toast,
  type ToastTone,
  type UpdateProgress,
} from "../types";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  openDownloadPage,
  relaunchApp,
} from "../updaterService";
import {
  savedConnectionNodeId,
  WorkspaceContext,
  type WorkspaceContextValue,
} from "./workspaceCore";
import {
  buildCountSql,
  buildDefaultObjectSql,
  buildObjectTabLabel,
  buildPageSql,
  buildStoredConnectionTree,
  connectionDisplayName,
  connectionKey,
  copyText,
  formatCommandMessage,
  isReadQuery,
  mergeExplorerTree,
  normalizeBaseSql,
  parseTrailingLimit,
  readErrorMessage,
  removeConnectionFromTree,
} from "./workspaceContext.utils";
import {
  buildOfficialObjectTabId,
  buildTemporaryObjectTabId,
  createOfficialSqlTab,
  loadSqlTabsForConnection,
  officializeSqlTab,
  saveSqlTabsForConnection,
} from "./workspaceSqlTabs";

// Per-tab, in-memory query state (never persisted to localStorage).
type TabResult = {
  state: QueryState;
  result: QueryResult | null;
  pagination: QueryPagination | null;
  error: string | null;
  connectionId: string;
  baseSql: string;
};

const emptyTabResult: TabResult = {
  state: "idle",
  result: null,
  pagination: null,
  error: null,
  connectionId: "",
  baseSql: "",
};

const defaultRowLimit = 50;

function getTabSelectionState(tab: SqlTab | null) {
  return {
    clearObjectDetails: !tab?.objectId,
    selectedObjectId: tab?.objectId ?? "",
  };
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
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [activeExplorerTree, setActiveExplorerTree] = useState<DatabaseTreeNode[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedObjectConnectionId, setSelectedObjectConnectionId] = useState("");
  const [selectedObject, setSelectedObject] = useState<DatabaseObjectDetails | null>(null);
  const [completionObject, setCompletionObject] = useState<DatabaseObjectDetails | null>(null);
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [resultsByTab, setResultsByTab] = useState<Record<string, TabResult>>({});
  const [resultTab, setResultTab] = useState<ResultPanelTab>("results");
  const [resultsOpen, setResultsOpen] = useState(true);
  const [closeWithUnsavedDialogOpen, setCloseWithUnsavedDialogOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const updateInProgressRef = useRef(false);
  const didCheckUpdateRef = useRef(false);
  const hasUnsavedTabsRef = useRef(false);
  const runningTabsRef = useRef<Set<string>>(new Set());
  const toastCounterRef = useRef(0);
  const sqlTabsRef = useRef<SqlTab[]>([]);
  const activeTabIdRef = useRef("");

  const activeConnection =
    connections.find((connection) => connection.id === activeConnectionId) ??
    connections[0] ??
    null;
  const requiresConnection = connections.length === 0;
  const activeTab = sqlTabs.find((tab) => tab.id === activeTabId) ?? null;
  const activeTabResult = resultsByTab[activeTabId] ?? null;
  const queryState = activeTabResult?.state ?? "idle";
  const queryResult = activeTabResult?.result ?? null;
  const queryPagination = activeTabResult?.pagination ?? null;
  const queryError = activeTabResult?.error ?? null;
  const hasUnsavedTabs = sqlTabs.some((tab) => tab.dirty);
  const hasStoredConnections = storedConnections.length > 0;
  const explorerTree = useMemo(
    () => buildStoredConnectionTree(storedConnections, activeExplorerTree),
    [activeExplorerTree, storedConnections],
  );
  const connectedConnectionKeys = useMemo(
    () => new Set(connections.map((connection) => connectionKey(connection))),
    [connections],
  );

  const connectionByKey = useCallback(
    (key: string | undefined) =>
      key ? (connections.find((connection) => connectionKey(connection) === key) ?? null) : null,
    [connections],
  );

  const notify = useCallback((text: string, tone: ToastTone = "default") => {
    toastCounterRef.current += 1;
    setToast({ id: toastCounterRef.current, text, tone });
  }, []);

  // Checks for a new release and, if found, downloads + installs it while a modal
  // reports progress, then relaunches into the new version. `silent` (the startup
  // check) stays quiet when already up to date or running outside the desktop app.
  const startUpdateCheck = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (updateInProgressRef.current) return;

      if (!("__TAURI_INTERNALS__" in window)) {
        if (!silent) notify("Updates are only available in the desktop app", "warning");
        return;
      }

      updateInProgressRef.current = true;
      try {
        // Checking can fail for benign reasons (no published release yet, offline,
        // missing latest.json). Never surface that as a modal — on the startup
        // (silent) check stay quiet; on a manual check just toast it.
        let update;
        try {
          update = await checkForUpdate();
        } catch (error) {
          if (!silent) notify(`Couldn't check for updates: ${readErrorMessage(error)}`, "warning");
          return;
        }

        if (!update) {
          if (!silent) notify("You're on the latest version", "success");
          return;
        }

        // An update exists: show the modal and report download/install progress.
        // Errors from here on are shown inside the modal since it's already open.
        setUpdateProgress({
          phase: "downloading",
          downloaded: 0,
          total: 0,
          version: update.version,
          notes: update.body ?? undefined,
        });
        setUpdateDialogOpen(true);

        try {
          await downloadAndInstallUpdate(update, ({ downloaded, total }) => {
            setUpdateProgress((previous) => ({
              phase: total > 0 && downloaded >= total ? "installing" : "downloading",
              downloaded,
              total,
              version: previous?.version ?? update.version,
              notes: previous?.notes,
            }));
          });

          setUpdateProgress((previous) => ({
            phase: "done",
            downloaded: previous?.total ?? 0,
            total: previous?.total ?? 0,
            version: previous?.version ?? update.version,
            notes: previous?.notes,
          }));
          await relaunchApp();
        } catch (error) {
          setUpdateProgress((previous) => ({
            phase: "error",
            downloaded: previous?.downloaded ?? 0,
            total: previous?.total ?? 0,
            version: previous?.version,
            error: readErrorMessage(error),
          }));
        }
      } finally {
        updateInProgressRef.current = false;
      }
    },
    [notify],
  );

  const dismissUpdateDialog = useCallback(() => {
    // Only meaningful on terminal states (error/done) — during download the modal
    // shows no close affordance, so this won't interrupt an in-flight install.
    setUpdateDialogOpen(false);
    setUpdateProgress(null);
  }, []);

  useEffect(() => {
    if (didCheckUpdateRef.current) return;
    didCheckUpdateRef.current = true;
    void startUpdateCheck({ silent: true });
  }, [startUpdateCheck]);

  const patchTabResult = useCallback((tabId: string, patch: Partial<TabResult>) => {
    setResultsByTab((previous) => ({
      ...previous,
      [tabId]: { ...emptyTabResult, ...previous[tabId], ...patch },
    }));
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
      if (!selectedObjectId) return;
      // Load details from the connection that owns the selected object, not the
      // globally active one — they can differ in a multi-connection workspace.
      const connection =
        connections.find((item) => item.id === selectedObjectConnectionId) ?? activeConnection;
      if (!connection) return;
      try {
        const details = await getPostgresObjectDetails(connection.id, selectedObjectId);
        if (!cancelled) {
          setSelectedObject(details);
          setCompletionObject(details);
        }
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
  }, [activeConnection, connections, notify, selectedObjectConnectionId, selectedObjectId]);

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
    // Tabs from all connected databases live in one array; persist each connection's
    // own subset under its storage key (saveSqlTabsForConnection keeps activeTabId only
    // when it belongs to that connection).
    for (const connection of connections) {
      const key = connectionKey(connection);
      saveSqlTabsForConnection(
        connection,
        sqlTabs.filter((tab) => tab.connectionKey === key),
        activeTabId,
      );
    }
  }, [activeTabId, connections, sqlTabs]);

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

  const commitSqlTab = useCallback((tabId: string) => {
    const currentTabs = sqlTabsRef.current;
    const currentTab = currentTabs.find((tab) => tab.id === tabId);
    if (!currentTab) return null;

    // Fall back to the tab's own connection (the active connection may differ now
    // that tabs from several databases coexist).
    const fallbackKey = currentTab.connectionKey ?? "";
    const officialized = officializeSqlTab(currentTabs, currentTab.id, fallbackKey);
    const nextActiveTabId = officialized.activeTabId;
    const nextTabs = officialized.tabs.map((tab) =>
      tab.id === nextActiveTabId ? { ...tab, dirty: false, savedSql: tab.sql } : tab,
    );
    const committedTab = nextTabs.find((tab) => tab.id === nextActiveTabId) ?? currentTab;

    sqlTabsRef.current = nextTabs;
    activeTabIdRef.current = nextActiveTabId;
    setSqlTabs(nextTabs);
    setActiveTabId(nextActiveTabId);
    // Persistence is handled reactively by the per-connection save effect.

    return committedTab;
  }, []);

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
      // Merge this connection's persisted tabs into the shared tab bar (dedupe by id)
      // instead of replacing — tabs from other connected databases stay open.
      setSqlTabs((current) => {
        const existing = new Set(current.map((tab) => tab.id));
        const additions = savedTabs.tabs.filter((tab) => !existing.has(tab.id));
        return [...current, ...additions];
      });

      const nextActiveTab = savedTabs.tabs.find((tab) => tab.id === savedTabs.activeTabId) ?? null;
      setCompletionObject(null);
      if (nextActiveTab) {
        setActiveTabId(nextActiveTab.id);
        syncExplorerSelectionWithTab(nextActiveTab);
      }
    },
    [syncExplorerSelectionWithTab],
  );

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
      setActiveConnectionId(result.connection.id);
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

  const activateConnection = useCallback((connection: ConnectionProfile) => {
    // All connections' tabs already live in the shared bar; just switch focus.
    setActiveConnectionId(connection.id);
  }, []);

  const openTemporaryObjectTab = useCallback((objectId: string, tabConnectionKey: string) => {
    if (!tabConnectionKey) return;

    const sql = buildDefaultObjectSql(objectId, defaultRowLimit);
    const label = buildObjectTabLabel(objectId);

    setSqlTabs((tabs) => {
      const reusableTemporaryTab = tabs.find(
        (currentTab) =>
          currentTab.state === "temporary" &&
          !currentTab.dirty &&
          currentTab.connectionKey === tabConnectionKey,
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
        return tabs.map((currentTab) =>
          currentTab.id === reusableTemporaryTab.id ? nextTab : currentTab,
        );
      }

      const nextTab: SqlTab = {
        connectionKey: tabConnectionKey,
        dirty: false,
        id: buildTemporaryObjectTabId(tabConnectionKey, objectId),
        label,
        objectId,
        savedSql: sql,
        sql,
        state: "temporary",
      };
      setActiveTabId(nextTab.id);
      return [...tabs, nextTab];
    });
  }, []);

  const makeObjectTabOfficial = useCallback((objectId: string, tabConnectionKey: string) => {
    if (!tabConnectionKey) return;

    const label = buildObjectTabLabel(objectId);
    const sql = buildDefaultObjectSql(objectId, defaultRowLimit);
    const officialTabId = buildOfficialObjectTabId(tabConnectionKey, objectId);

    setSqlTabs((tabs) => {
      const existingOfficialTab = tabs.find(
        (tab) => tab.state === "official" && tab.objectId === objectId,
      );
      if (existingOfficialTab) {
        setActiveTabId(existingOfficialTab.id);
        return tabs;
      }

      const temporaryTab = tabs.find(
        (tab) => tab.state === "temporary" && tab.objectId === objectId,
      );
      if (temporaryTab) {
        setActiveTabId(officialTabId);
        return officializeSqlTab(tabs, temporaryTab.id, tabConnectionKey).tabs;
      }

      const officialTab = createOfficialSqlTab({
        connectionKey: tabConnectionKey,
        dirty: false,
        label,
        objectId,
        savedSql: sql,
        sql,
      });
      setActiveTabId(officialTabId);
      return [...tabs, officialTab];
    });
  }, []);

  const selectObject = useCallback(
    (objectId: string, objectConnectionKey?: string) => {
      const connection = connectionByKey(objectConnectionKey) ?? activeConnection;
      if (!connection) return;
      activateConnection(connection);
      setSelectedObjectId(objectId);
      setSelectedObjectConnectionId(connection.id);
      openTemporaryObjectTab(objectId, connectionKey(connection));
    },
    [activeConnection, activateConnection, connectionByKey, openTemporaryObjectTab],
  );

  const confirmObjectTab = useCallback(
    (objectId: string, objectConnectionKey?: string) => {
      const connection = connectionByKey(objectConnectionKey) ?? activeConnection;
      if (!connection) return;
      activateConnection(connection);
      setSelectedObjectId(objectId);
      setSelectedObjectConnectionId(connection.id);
      makeObjectTabOfficial(objectId, connectionKey(connection));
    },
    [activeConnection, activateConnection, connectionByKey, makeObjectTabOfficial],
  );

  // Fetches a single page of a read query via SQL LIMIT/OFFSET and renders it into
  // the given tab. `baseSql` must be normalized; `totalRows` comes from the COUNT run.
  const executePage = useCallback(
    async (
      tabId: string,
      connectionId: string,
      baseSql: string,
      pageSize: number,
      page: number,
      totalRows: number,
      pageSizeLocked: boolean,
    ) => {
      patchTabResult(tabId, { state: "running", error: null });
      try {
        const pageSql = buildPageSql(baseSql, pageSize, page);
        const execution = await runPostgresQuery(connectionId, pageSql);
        patchTabResult(tabId, {
          state: "success",
          error: null,
          connectionId,
          baseSql,
          pagination: { page, pageSize, totalRows, pageSizeLocked },
          result: {
            id: crypto.randomUUID(),
            sql: pageSql,
            columns: execution.columns,
            rows: execution.rows.map((row) => row.map((cell) => cell ?? "NULL")),
            durationMs: execution.durationMs,
            rowCount: execution.rowCount,
            message: `${totalRows} rows · ${pageSize}/page · ${execution.durationMs} ms`,
          },
        });
        return true;
      } catch (error) {
        const message = readErrorMessage(error);
        patchTabResult(tabId, { state: "error", error: message, result: null, pagination: null });
        notify(message, "warning");
        return false;
      }
    },
    [notify, patchTabResult],
  );

  const runQuery = useCallback(async () => {
    if (requiresConnection || !activeConnection) {
      setDialogInitialDraft(null);
      setConnectionDialogOpen(true);
      notify("Create a connection before running queries", "warning");
      return;
    }

    // Officializing a temporary tab can change its id (object tabs), so use the
    // committed tab as the source of truth for both the id and the SQL to run —
    // otherwise results would be stored under the dead temporary id.
    const committedTab = activeTabId ? commitSqlTab(activeTabId) : null;
    if (!committedTab) {
      notify("Open a tab to run a query", "warning");
      return;
    }

    const tabId = committedTab.id;
    if (runningTabsRef.current.has(tabId)) return;

    const sql = committedTab.sql.trim();
    if (!sql) {
      notify("Write a query to run", "warning");
      return;
    }

    // Run against the connection that owns this tab, not the globally active one.
    const connection = connectionByKey(committedTab.connectionKey) ?? activeConnection;
    if (!connection) {
      notify("This tab's connection is no longer available", "warning");
      return;
    }
    const connectionId = connection.id;
    const baseSql = normalizeBaseSql(sql);

    runningTabsRef.current.add(tabId);
    setResultsOpen(true);
    setResultTab("results");
    patchTabResult(tabId, { state: "running", error: null, connectionId, baseSql });

    try {
      if (isReadQuery(baseSql)) {
        // Pagination is always on for read queries. Page size = the user's own
        // trailing LIMIT if present (locked), otherwise the selector default. We
        // strip that trailing LIMIT so COUNT/OFFSET page over the full result set.
        const parsed = parseTrailingLimit(baseSql);
        const pageSize = parsed?.pageSize ?? defaultRowLimit;
        const querySql = parsed?.baseSql ?? baseSql;
        const locked = parsed !== null;
        const count = await runPostgresQuery(connectionId, buildCountSql(querySql));
        const totalRows = Number(count.rows[0]?.[0] ?? 0);
        const ok = await executePage(tabId, connectionId, querySql, pageSize, 0, totalRows, locked);
        if (ok) notify(`${totalRows} rows · ${pageSize}/page`, "success");
      } else {
        // Non-read statements run as-is (no pagination). Returned rows (incl.
        // RETURNING) still show, plus the command result message.
        const execution = await runPostgresQuery(connectionId, baseSql);
        const message = formatCommandMessage(
          execution.commandTag,
          execution.rowsAffected,
          execution.durationMs,
        );
        patchTabResult(tabId, {
          state: "success",
          error: null,
          connectionId,
          baseSql,
          pagination: null,
          result: {
            id: crypto.randomUUID(),
            sql: baseSql,
            columns: execution.columns,
            rows: execution.rows.map((row) => row.map((cell) => cell ?? "NULL")),
            durationMs: execution.durationMs,
            rowCount: execution.rowCount,
            message,
          },
        });
        notify(message, "success");
      }
    } catch (error) {
      const message = readErrorMessage(error);
      patchTabResult(tabId, { state: "error", error: message, result: null, pagination: null });
      notify(message, "warning");
    } finally {
      runningTabsRef.current.delete(tabId);
    }
  }, [
    activeConnection,
    activeTabId,
    commitSqlTab,
    connectionByKey,
    executePage,
    notify,
    patchTabResult,
    requiresConnection,
  ]);

  const goToQueryPage = useCallback(
    async (page: number) => {
      const tabId = activeTabId;
      const current = resultsByTab[tabId];
      if (!current || !current.pagination) return;
      if (runningTabsRef.current.has(tabId)) return;

      const { pageSize, totalRows, page: currentPage, pageSizeLocked } = current.pagination;
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
      const target = Math.min(Math.max(page, 0), totalPages - 1);
      if (target === currentPage) return;

      runningTabsRef.current.add(tabId);
      try {
        await executePage(
          tabId,
          current.connectionId,
          current.baseSql,
          pageSize,
          target,
          totalRows,
          pageSizeLocked,
        );
      } finally {
        runningTabsRef.current.delete(tabId);
      }
    },
    [activeTabId, executePage, resultsByTab],
  );

  const setQueryPageSize = useCallback(
    async (pageSize: number) => {
      const tabId = activeTabId;
      const current = resultsByTab[tabId];
      if (!current || !current.pagination || pageSize === current.pagination.pageSize) return;
      // When the page size comes from the user's own LIMIT, the selector is locked.
      if (current.pagination.pageSizeLocked) return;
      if (runningTabsRef.current.has(tabId)) return;

      runningTabsRef.current.add(tabId);
      try {
        await executePage(
          tabId,
          current.connectionId,
          current.baseSql,
          pageSize,
          0,
          current.pagination.totalRows,
          false,
        );
      } finally {
        runningTabsRef.current.delete(tabId);
      }
    },
    [activeTabId, executePage, resultsByTab],
  );

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

  const refreshConnection = useCallback(
    async (targetConnectionKey?: string) => {
      const connection = connectionByKey(targetConnectionKey) ?? activeConnection;
      if (!connection) {
        notify("Connect to a database before refreshing", "warning");
        return;
      }

      try {
        const tree = await listPostgresTree(connection.id);
        setActiveExplorerTree((current) => mergeExplorerTree(current, tree));
        // Refresh the selected object's details too, if it belongs to this connection.
        if (selectedObjectId && selectedObjectConnectionId === connection.id) {
          const details = await getPostgresObjectDetails(connection.id, selectedObjectId);
          setSelectedObject(details);
          setCompletionObject(details);
        }
        notify(`${connection.database} refreshed`, "success");
      } catch (error) {
        notify(readErrorMessage(error), "warning");
      }
    },
    [activeConnection, connectionByKey, notify, selectedObjectConnectionId, selectedObjectId],
  );

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

  const openSchemaTab = useCallback(async () => {
    if (requiresConnection) {
      notify("Create a connection before opening the schema", "warning");
      return;
    }

    setResultsOpen(true);
    setResultTab("schema");
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

  const copySchema = useCallback(async () => {
    if (!selectedObject) {
      notify("Select an object before copying its schema", "warning");
      return;
    }

    await copyText(buildObjectSchema(selectedObject));
    notify("Schema copied to clipboard", "success");
  }, [notify, selectedObject]);

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

      // The password dialog already prompts for the password — no toast needed.
      setPasswordConnection(connection);
    },
    [storedConnections],
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
      // The active connection follows the active tab so operations default to its DB.
      const owner = connectionByKey(tab?.connectionKey);
      if (owner) setActiveConnectionId(owner.id);
      syncExplorerSelectionWithTab(tab);
    },
    [connectionByKey, sqlTabs, syncExplorerSelectionWithTab],
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
      // Keep the active connection in sync with the newly focused tab.
      const owner = connectionByKey(nextActiveTab?.connectionKey);
      if (owner) setActiveConnectionId(owner.id);
      syncExplorerSelectionWithTab(nextActiveTab);
      runningTabsRef.current.delete(tabId);
      setResultsByTab((previous) => {
        if (!(tabId in previous)) return previous;
        const next = { ...previous };
        delete next[tabId];
        return next;
      });
      notify(`Closed ${sqlTabs[closingTabIndex]!.label}`);
    },
    [activeTabId, connectionByKey, notify, sqlTabs, syncExplorerSelectionWithTab],
  );

  const closeWindowAfterResolution = useCallback(
    async (mode: "save" | "discard") => {
      if (mode === "save") {
        await saveDirtySqlTabs();
      }

      setCloseWithUnsavedDialogOpen(false);
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
            item.engine === connection.engine &&
            item.host === connection.host &&
            item.port === connection.port &&
            item.database === connection.database &&
            item.user === connection.user
          ),
      );

      const removedKey = connectionKey(connection);
      setStoredConnections(nextStoredConnections);
      setActiveExplorerTree((current) => removeConnectionFromTree(current, connection));
      setConnections(nextConnections);

      // Drop only this connection's tabs from the shared bar.
      const remainingTabs = sqlTabs.filter((tab) => tab.connectionKey !== removedKey);
      setSqlTabs(remainingTabs);

      const wasActiveConnection =
        activeConnection && connectionKey(activeConnection) === removedKey;

      if (wasActiveConnection) {
        setSelectedObjectId("");
        setSelectedObject(null);
        setCompletionObject(null);
        // Refocus a surviving tab (and its connection) if the active one was removed.
        const stillActive = remainingTabs.some((tab) => tab.id === activeTabId);
        const nextActiveTab = stillActive
          ? (remainingTabs.find((tab) => tab.id === activeTabId) ?? null)
          : (remainingTabs[0] ?? null);
        setActiveTabId(nextActiveTab?.id ?? "");
        const owner = connectionByKey(nextActiveTab?.connectionKey) ?? nextConnections[0] ?? null;
        setActiveConnectionId(owner?.id ?? "");
      }

      if (nextStoredConnections.length === 0) {
        setDialogInitialDraft(null);
        setConnectionDialogOpen(true);
      }

      notify(`${connection.database} removed`, "success");
      setDeleteConnectionRequest(null);
    },
    [activeConnection, activeTabId, connectionByKey, connections, notify, sqlTabs],
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
      copySchema,
      copyObjectName,
      copyResult,
      deleteConnection,
      exportCsv,
      goToQueryPage,
      openSchemaTab,
      openNewConnectionDialog,
      openSavedConnection,
      previewObject,
      refreshAll,
      refreshConnection,
      runQuery,
      saveActiveSqlTab,
      setQueryPageSize,
      saveConnection,
      selectObject,
      selectResultTab: setResultTab,
      selectSqlTab,
      setConnectionDialogOpen,
      startUpdateCheck,
      dismissUpdateDialog,
      openDownloadPage: () => void openDownloadPage(),
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
      completionObject,
      connections,
      deleteConnectionRequest,
      dialogInitialDraft,
      dialogs: {
        connection: connectionDialogOpen,
        unsavedTabs: closeWithUnsavedDialogOpen,
      },
      passwordConnection,
      queryError,
      queryPagination,
      queryResult,
      queryState,
      resultTab,
      toast,
      resultsOpen,
      selectedObject,
      selectedObjectId,
      sqlTabs,
      storedConnections,
      updateDialogOpen,
      updateProgress,
    },
  };

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
