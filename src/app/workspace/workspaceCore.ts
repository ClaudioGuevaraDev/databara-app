import { createContext, use } from "react";
import type { StoredConnectionDraft } from "../databaraService";
import type {
  ColumnDefinition,
  ConnectionDraft,
  ConnectionProfile,
  DatabaseObjectDetails,
  DatabaseTreeNode,
  QueryState,
  QueryResult,
  ResultPanelTab,
  SqlTab,
} from "../types";

export type WorkspaceState = {
  activeConnection: ConnectionProfile | null;
  activeTab: SqlTab | null;
  activeTabId: string;
  collapsedNodes: Set<string>;
  connections: ConnectionProfile[];
  deleteConnectionRequest: StoredConnectionDraft | null;
  dialogInitialDraft: StoredConnectionDraft | null;
  dialogs: {
    connection: boolean;
    unsavedTabs: boolean;
  };
  passwordConnection: StoredConnectionDraft | null;
  queryResult: QueryResult | null;
  queryState: QueryState;
  resultTab: ResultPanelTab;
  resultsOpen: boolean;
  selectedObject: DatabaseObjectDetails | null;
  selectedObjectId: string;
  sqlTabs: SqlTab[];
  storedConnections: StoredConnectionDraft[];
};

export type WorkspaceActions = {
  closeDeleteConnectionDialog: () => void;
  closePasswordDialog: () => void;
  closeResults: () => void;
  closeSqlTab: (tabId: string) => void;
  closeUnsavedTabsDialog: () => void;
  closeWindowAfterResolution: (mode: "save" | "discard") => Promise<void>;
  confirmDeleteConnection: (connection: StoredConnectionDraft) => void;
  confirmObjectTab: (objectId: string) => void;
  connectStoredConnection: (connection: StoredConnectionDraft, password: string) => Promise<void>;
  copyObjectName: () => Promise<void>;
  copySchema: () => Promise<void>;
  copyResult: () => Promise<void>;
  deleteConnection: (nodeId: string) => void;
  exportCsv: () => void;
  openSchemaTab: () => Promise<void>;
  openNewConnectionDialog: () => void;
  openSavedConnection: (nodeId: string) => void;
  previewObject: (objectId?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  runQuery: () => void;
  saveActiveSqlTab: () => Promise<void>;
  saveConnection: (draft: ConnectionDraft) => Promise<void>;
  selectObject: (objectId: string) => void;
  selectResultTab: (tab: ResultPanelTab) => void;
  selectSqlTab: (tabId: string) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  toggleNode: (nodeId: string) => void;
  updateActiveSql: (sql: string) => void;
};

export type WorkspaceMeta = {
  connectedConnectionKeys: Set<string>;
  explorerTree: DatabaseTreeNode[];
  hasStoredConnections: boolean;
  hasUnsavedTabs: boolean;
  requiresConnection: boolean;
};

export type WorkspaceContextValue = {
  state: WorkspaceState;
  actions: WorkspaceActions;
  meta: WorkspaceMeta;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const value = use(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return value;
}

export function useWorkspaceLayout() {
  const { actions, meta, state } = useWorkspace();
  return {
    activeConnection: state.activeConnection,
    openNewConnectionDialog: actions.openNewConnectionDialog,
    requiresConnection: meta.requiresConnection,
  };
}

export function useExplorer() {
  const { actions, meta, state } = useWorkspace();
  return {
    activeConnection: state.activeConnection,
    collapsedNodes: state.collapsedNodes,
    connectedConnectionKeys: meta.connectedConnectionKeys,
    explorerTree: meta.explorerTree,
    openNewConnectionDialog: actions.openNewConnectionDialog,
    selectedObjectId: state.selectedObjectId,
    storedConnections: state.storedConnections,
    confirmObjectTab: actions.confirmObjectTab,
    deleteConnection: actions.deleteConnection,
    openSavedConnection: actions.openSavedConnection,
    selectObject: actions.selectObject,
    toggleNode: actions.toggleNode,
  };
}

export function useSqlEditor() {
  const { actions, state } = useWorkspace();
  return {
    activeTab: state.activeTab,
    activeTabId: state.activeTabId,
    sqlTabs: state.sqlTabs,
    closeSqlTab: actions.closeSqlTab,
    runQuery: actions.runQuery,
    saveActiveSqlTab: actions.saveActiveSqlTab,
    selectSqlTab: actions.selectSqlTab,
    updateActiveSql: actions.updateActiveSql,
  };
}

export function useResults() {
  const { actions, state } = useWorkspace();
  return {
    details: state.selectedObject,
    queryResult: state.queryResult,
    queryState: state.queryState,
    resultTab: state.resultTab,
    resultsOpen: state.resultsOpen,
    closeResults: actions.closeResults,
    copySchema: actions.copySchema,
    copyResult: actions.copyResult,
    exportCsv: actions.exportCsv,
    selectResultTab: actions.selectResultTab,
  };
}

export function useObjectDetailsPanel() {
  const { actions, state } = useWorkspace();
  return {
    details: state.selectedObject,
    copyObjectName: actions.copyObjectName,
    openSchemaTab: actions.openSchemaTab,
    previewObject: actions.previewObject,
    refreshAll: actions.refreshAll,
  };
}

export function useEmptyWorkspace() {
  const { actions, meta, state } = useWorkspace();
  return {
    hasStoredConnections: meta.hasStoredConnections,
    storedConnections: state.storedConnections,
    openNewConnectionDialog: actions.openNewConnectionDialog,
    openSavedConnection: actions.openSavedConnection,
  };
}

export function useDialogs() {
  const { actions, state } = useWorkspace();
  return {
    connectionDialogOpen: state.dialogs.connection,
    deleteConnectionRequest: state.deleteConnectionRequest,
    dialogInitialDraft: state.dialogInitialDraft,
    passwordConnection: state.passwordConnection,
    unsavedTabsDialogOpen: state.dialogs.unsavedTabs,
    closeDeleteConnectionDialog: actions.closeDeleteConnectionDialog,
    closePasswordDialog: actions.closePasswordDialog,
    closeUnsavedTabsDialog: actions.closeUnsavedTabsDialog,
    closeWindowAfterResolution: actions.closeWindowAfterResolution,
    confirmDeleteConnection: actions.confirmDeleteConnection,
    connectStoredConnection: actions.connectStoredConnection,
    saveConnection: actions.saveConnection,
    setConnectionDialogOpen: actions.setConnectionDialogOpen,
  };
}

export function savedConnectionNodeId(connection: StoredConnectionDraft) {
  return `saved-connection:${connection.engine}:${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
}

export function formatColumn(column: ColumnDefinition) {
  const traits = [
    column.primaryKey ? "primary key" : null,
    column.nullable ? "nullable" : "not null",
    column.indexed ? "indexed" : null,
  ].filter(Boolean);

  return `${column.dataType}${traits.length ? ` - ${traits.join(", ")}` : ""}`;
}

export function formatIndex(index: DatabaseObjectDetails["indexes"][number]) {
  const traits = [index.primary ? "primary" : null, index.unique ? "unique" : null].filter(Boolean);
  return `${index.columns.join(", ")}${traits.length ? ` ${traits.join(" ")}` : ""}`;
}
