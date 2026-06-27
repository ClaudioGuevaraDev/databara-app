import { invoke } from "@tauri-apps/api/core";
import {
  defaultDatabaseEngine,
  ensureSupportedConnectionEngine,
  normalizeDatabaseEngine,
} from "./connectionEngines";
import type {
  ConnectionDraft,
  ConnectionProfile,
  ConnectionTestResult,
  DatabaseEngine,
  DatabaseObjectDetails,
  DatabaseTreeNode,
  Language,
  NotificationPosition,
  SslMode,
} from "./types";

export type StoredConnectionDraft = Omit<ConnectionDraft, "password">;

type BackendConnectionDraft = Omit<ConnectionDraft, "engine">;

type BackendConnectionProfile = Omit<ConnectionProfile, "engine"> & {
  engine: DatabaseEngine | "PostgreSQL";
};

type BackendDatabaseObjectDetails = Omit<DatabaseObjectDetails, "engine"> & {
  engine: DatabaseEngine | "PostgreSQL";
};

type BackendConnectResult = Omit<ConnectResult, "connection" | "tree"> & {
  connection: BackendConnectionProfile;
  tree: DatabaseTreeNode[];
};

export type ConnectResult = {
  connection: ConnectionProfile;
  tree: DatabaseTreeNode[];
  selectedObjectId: string | null;
  selectedObject: DatabaseObjectDetails | null;
};

const legacyStoredConnectionKey = "databara.postgres.connection";
const legacyStoredConnectionsKey = "databara.postgres.connections";
const storedConnectionsKey = "databara.connections.v1";

const settingsStorageKey = "databara.settings.v1";

// Custom display names for server groups, keyed by server node id
// (`server:<engine>:<host>:<port>`). Absent entry → fall back to `host:port`.
const serverLabelsKey = "databara.serverLabels.v1";

export type AppSettings = {
  zoom: { level: number };
  // When enabled, connection passwords are stored in the OS keychain so
  // connections reconnect on startup without prompting.
  keepConnectionsActive: { enabled: boolean };
  // When enabled, connecting to a database also connects (in the background) to
  // the other already-saved databases on the same server.
  activateSiblingConnections: { enabled: boolean };
  // When enabled, connecting to a database discovers the other databases on the
  // same server and lists them in the sidebar (without connecting them).
  discoverServerDatabases: { enabled: boolean };
  // Font size (in px) of the Monaco SQL editor.
  editorFontSize: { size: number };
  // On-screen corner/edge where toast notifications appear.
  notificationPosition: { position: NotificationPosition };
  // Width (in px) of the explorer sidebar.
  sidebarWidth: { width: number };
  // Height (in px) of the bottom results panel.
  bottomPanelHeight: { height: number };
  // Language code for the interface.
  language: { code: Language };
};

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en"];

export const NOTIFICATION_POSITIONS: readonly NotificationPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

// Zoom level is stored as a percent integer (100 = normal, no scaling). CSS
// `zoom` receives level / 100.
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;

// SQL editor font size, in px.
export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 24;
export const EDITOR_FONT_SIZE_STEP = 1;

// Explorer sidebar width, in px.
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 600;
export const SIDEBAR_WIDTH_STEP = 1;
export const SIDEBAR_WIDTH_DEFAULT = 320;

// Bottom results panel height, in px.
export const BOTTOM_PANEL_HEIGHT_MIN = 160;
export const BOTTOM_PANEL_HEIGHT_MAX = 800;
export const BOTTOM_PANEL_HEIGHT_STEP = 1;
export const BOTTOM_PANEL_HEIGHT_DEFAULT = 360;

export const defaultAppSettings: AppSettings = {
  zoom: { level: 100 },
  keepConnectionsActive: { enabled: false },
  activateSiblingConnections: { enabled: false },
  discoverServerDatabases: { enabled: false },
  editorFontSize: { size: 13 },
  notificationPosition: { position: "top-center" },
  sidebarWidth: { width: SIDEBAR_WIDTH_DEFAULT },
  bottomPanelHeight: { height: BOTTOM_PANEL_HEIGHT_DEFAULT },
  language: { code: "en" },
};

export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return defaultAppSettings.zoom.level;
  const snapped = Math.round(level / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, snapped));
}

export function clampEditorFontSize(size: number): number {
  if (!Number.isFinite(size)) return defaultAppSettings.editorFontSize.size;
  const snapped = Math.round(size);
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, snapped));
}

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return defaultAppSettings.sidebarWidth.width;
  const snapped = Math.round(width);
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, snapped));
}

export function clampBottomPanelHeight(height: number): number {
  if (!Number.isFinite(height)) return defaultAppSettings.bottomPanelHeight.height;
  const snapped = Math.round(height);
  return Math.min(BOTTOM_PANEL_HEIGHT_MAX, Math.max(BOTTOM_PANEL_HEIGHT_MIN, snapped));
}

// Reads a `{ enabled: boolean }` setting from raw localStorage, falling back to
// the provided default when missing or malformed.
function normalizeEnabledFlag(raw: unknown, key: string, fallback: boolean): { enabled: boolean } {
  const entry = (raw as Record<string, unknown>)[key];
  const enabled =
    entry && typeof entry === "object" ? (entry as { enabled?: unknown }).enabled : undefined;
  return { enabled: typeof enabled === "boolean" ? enabled : fallback };
}

function normalizeAppSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return defaultAppSettings;
  const zoom = (raw as { zoom?: unknown }).zoom;
  const level = zoom && typeof zoom === "object" ? (zoom as { level?: unknown }).level : undefined;
  const editorFontSize = (raw as { editorFontSize?: unknown }).editorFontSize;
  const size =
    editorFontSize && typeof editorFontSize === "object"
      ? (editorFontSize as { size?: unknown }).size
      : undefined;
  const notificationPosition = (raw as { notificationPosition?: unknown }).notificationPosition;
  const position =
    notificationPosition && typeof notificationPosition === "object"
      ? (notificationPosition as { position?: unknown }).position
      : undefined;
  const sidebarWidth = (raw as { sidebarWidth?: unknown }).sidebarWidth;
  const width =
    sidebarWidth && typeof sidebarWidth === "object"
      ? (sidebarWidth as { width?: unknown }).width
      : undefined;
  const bottomPanelHeight = (raw as { bottomPanelHeight?: unknown }).bottomPanelHeight;
  const height =
    bottomPanelHeight && typeof bottomPanelHeight === "object"
      ? (bottomPanelHeight as { height?: unknown }).height
      : undefined;
  const language = (raw as { language?: unknown }).language;
  const code =
    language && typeof language === "object" ? (language as { code?: unknown }).code : undefined;
  return {
    zoom: {
      level: clampZoomLevel(typeof level === "number" ? level : defaultAppSettings.zoom.level),
    },
    keepConnectionsActive: normalizeEnabledFlag(
      raw,
      "keepConnectionsActive",
      defaultAppSettings.keepConnectionsActive.enabled,
    ),
    activateSiblingConnections: normalizeEnabledFlag(
      raw,
      "activateSiblingConnections",
      defaultAppSettings.activateSiblingConnections.enabled,
    ),
    discoverServerDatabases: normalizeEnabledFlag(
      raw,
      "discoverServerDatabases",
      defaultAppSettings.discoverServerDatabases.enabled,
    ),
    editorFontSize: {
      size: clampEditorFontSize(
        typeof size === "number" ? size : defaultAppSettings.editorFontSize.size,
      ),
    },
    notificationPosition: {
      position: NOTIFICATION_POSITIONS.includes(position as NotificationPosition)
        ? (position as NotificationPosition)
        : defaultAppSettings.notificationPosition.position,
    },
    sidebarWidth: {
      width: clampSidebarWidth(
        typeof width === "number" ? width : defaultAppSettings.sidebarWidth.width,
      ),
    },
    bottomPanelHeight: {
      height: clampBottomPanelHeight(
        typeof height === "number" ? height : defaultAppSettings.bottomPanelHeight.height,
      ),
    },
    language: {
      code: SUPPORTED_LANGUAGES.includes(code as Language)
        ? (code as Language)
        : defaultAppSettings.language.code,
    },
  };
}

export function loadAppSettings(): AppSettings {
  const raw = window.localStorage.getItem(settingsStorageKey);
  if (!raw) return defaultAppSettings;
  try {
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(settingsStorageKey);
    return defaultAppSettings;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

export function loadServerLabels(): Record<string, string> {
  const raw = window.localStorage.getItem(serverLabelsKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    return Object.fromEntries(entries);
  } catch {
    window.localStorage.removeItem(serverLabelsKey);
    return {};
  }
}

function saveServerLabels(labels: Record<string, string>): void {
  window.localStorage.setItem(serverLabelsKey, JSON.stringify(labels));
}

// Trims the name; an empty name removes the custom label (reverts to host:port).
export function saveServerLabel(serverId: string, name: string): Record<string, string> {
  const labels = loadServerLabels();
  const trimmed = name.trim();
  if (trimmed) labels[serverId] = trimmed;
  else delete labels[serverId];
  saveServerLabels(labels);
  return labels;
}

export function deleteServerLabel(serverId: string): Record<string, string> {
  const labels = loadServerLabels();
  delete labels[serverId];
  saveServerLabels(labels);
  return labels;
}

// Whether this install can apply an in-app update. False for Linux .deb/.rpm
// installs (only an AppImage can self-update). Assume true outside Tauri.
export async function updatesSupported(): Promise<boolean> {
  if (!("__TAURI_INTERNALS__" in window)) return true;
  return invoke<boolean>("updates_supported");
}

// Connection passwords are stored in the OS keychain (never localStorage),
// keyed by the connection key. These no-op / return null outside the Tauri
// runtime (e.g. `pnpm run dev` in a browser).
export async function storeConnectionPassword(account: string, password: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  return invoke<void>("store_connection_password", { account, password });
}

export async function getConnectionPassword(account: string): Promise<string | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  return invoke<string | null>("get_connection_password", { account });
}

export async function deleteConnectionPassword(account: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  return invoke<void>("delete_connection_password", { account });
}

export async function testPostgresConnection(
  draft: ConnectionDraft,
): Promise<ConnectionTestResult> {
  ensureSupportedConnectionEngine(draft);
  return invoke<ConnectionTestResult>("test_postgres_connection", { draft: toBackendDraft(draft) });
}

export async function connectPostgres(draft: ConnectionDraft): Promise<ConnectResult> {
  ensureSupportedConnectionEngine(draft);
  const result = await invoke<BackendConnectResult>("connect_postgres", {
    draft: toBackendDraft(draft),
  });
  const engine = normalizeDatabaseEngine(result.connection.engine);

  return {
    ...result,
    connection: {
      ...result.connection,
      engine,
    },
    tree: normalizeTreeForEngine(result.tree, engine),
  };
}

export async function listPostgresTree(connectionId: string): Promise<DatabaseTreeNode[]> {
  const tree = await invoke<DatabaseTreeNode[]>("list_postgres_tree", { connectionId });
  return normalizeTreeForEngine(tree, defaultDatabaseEngine);
}

export async function getPostgresObjectDetails(
  connectionId: string,
  objectId: string,
): Promise<DatabaseObjectDetails> {
  const details = await invoke<BackendDatabaseObjectDetails>("get_postgres_object_details", {
    connectionId,
    objectId,
  });
  return {
    ...details,
    engine: normalizeDatabaseEngine(details.engine),
  };
}

export type QueryExecutionResult = {
  columns: string[];
  rows: (string | null)[][];
  rowCount: number;
  durationMs: number;
  rowsAffected: number | null;
  commandTag: string | null;
};

export async function runPostgresQuery(
  connectionId: string,
  sql: string,
): Promise<QueryExecutionResult> {
  return invoke<QueryExecutionResult>("run_postgres_query", { connectionId, sql });
}

// Lists the other (non-template, connectable) databases living on the same
// server as the given live connection, excluding the one it is connected to.
export async function fetchServerDatabaseNames(connectionId: string): Promise<string[]> {
  const result = await runPostgresQuery(
    connectionId,
    "SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true AND datname <> current_database() ORDER BY datname",
  );
  return result.rows.map((row) => row[0]).filter((value): value is string => value !== null);
}

export async function setUnsavedSqlTabs(hasUnsaved: boolean): Promise<void> {
  return invoke<void>("set_unsaved_sql_tabs", { hasUnsaved });
}

export async function closeMainWindowAfterUnsavedResolution(): Promise<void> {
  return invoke<void>("close_main_window_after_unsaved_resolution");
}

export function loadStoredConnections(): StoredConnectionDraft[] {
  const rawConnections = window.localStorage.getItem(storedConnectionsKey);

  if (rawConnections) {
    try {
      const connections = JSON.parse(rawConnections) as unknown[];
      return Array.isArray(connections)
        ? connections.flatMap((connection) => {
            const normalized = normalizeStoredConnection(connection);
            return normalized ? [normalized] : [];
          })
        : [];
    } catch {
      window.localStorage.removeItem(storedConnectionsKey);
    }
  }

  const rawLegacyConnections = window.localStorage.getItem(legacyStoredConnectionsKey);
  if (rawLegacyConnections) {
    try {
      const connections = JSON.parse(rawLegacyConnections) as unknown[];
      const normalizedConnections = Array.isArray(connections)
        ? connections.flatMap((connection) => {
            const normalized = normalizeStoredConnection(connection);
            return normalized ? [normalized] : [];
          })
        : [];
      saveStoredConnections(normalizedConnections);
      window.localStorage.removeItem(legacyStoredConnectionsKey);
      return normalizedConnections;
    } catch {
      window.localStorage.removeItem(legacyStoredConnectionsKey);
    }
  }

  const rawLegacyConnection = window.localStorage.getItem(legacyStoredConnectionKey);
  if (!rawLegacyConnection) return [];

  try {
    const legacyConnection = normalizeStoredConnection(JSON.parse(rawLegacyConnection));
    if (!legacyConnection) {
      window.localStorage.removeItem(legacyStoredConnectionKey);
      return [];
    }
    saveStoredConnections([legacyConnection]);
    window.localStorage.removeItem(legacyStoredConnectionKey);
    return [legacyConnection];
  } catch {
    window.localStorage.removeItem(legacyStoredConnectionKey);
    return [];
  }
}

export function saveStoredConnection(draft: ConnectionDraft): StoredConnectionDraft[] {
  const storedDraft: StoredConnectionDraft = {
    engine: draft.engine,
    name: draft.name,
    host: draft.host,
    port: draft.port,
    database: draft.database,
    user: draft.user,
    sslMode: draft.sslMode,
  };

  const savedConnections = loadStoredConnections();
  const existingIndex = savedConnections.findIndex(
    (connection) =>
      connection.engine === storedDraft.engine &&
      connection.host === storedDraft.host &&
      connection.port === storedDraft.port &&
      connection.database === storedDraft.database &&
      connection.user === storedDraft.user,
  );

  // Preserve creation order: update an existing connection in place (keeps its
  // position) and append brand-new ones at the end. The sidebar order must never
  // shift on connect/reconnect/save.
  const nextConnections =
    existingIndex === -1
      ? [...savedConnections, storedDraft]
      : savedConnections.map((connection, index) =>
          index === existingIndex ? storedDraft : connection,
        );

  saveStoredConnections(nextConnections);
  return nextConnections;
}

export function deleteStoredConnection(connectionToDelete: StoredConnectionDraft) {
  const nextConnections = loadStoredConnections().filter(
    (connection) =>
      !(
        connection.engine === connectionToDelete.engine &&
        connection.host === connectionToDelete.host &&
        connection.port === connectionToDelete.port &&
        connection.database === connectionToDelete.database &&
        connection.user === connectionToDelete.user
      ),
  );

  saveStoredConnections(nextConnections);
  return nextConnections;
}

function saveStoredConnections(connections: StoredConnectionDraft[]) {
  window.localStorage.setItem(storedConnectionsKey, JSON.stringify(connections));
}

function toBackendDraft(draft: ConnectionDraft): BackendConnectionDraft {
  return {
    database: draft.database,
    host: draft.host,
    name: draft.name,
    password: draft.password,
    port: draft.port,
    sslMode: draft.sslMode,
    user: draft.user,
  };
}

function normalizeTreeForEngine(
  tree: DatabaseTreeNode[],
  engine: DatabaseEngine,
): DatabaseTreeNode[] {
  return tree.map((node) => {
    const id = node.id.startsWith("server:") ? `server:${engine}:${node.id.slice(7)}` : node.id;

    return {
      ...node,
      id,
      children: node.children ? normalizeTreeForEngine(node.children, engine) : node.children,
    };
  });
}

function normalizeStoredConnection(connection: unknown): StoredConnectionDraft | null {
  if (!connection || typeof connection !== "object") return null;

  const candidate = connection as Partial<StoredConnectionDraft> & {
    sslMode?: SslMode;
  };
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.host !== "string" ||
    typeof candidate.port !== "number" ||
    typeof candidate.database !== "string" ||
    typeof candidate.user !== "string"
  ) {
    return null;
  }

  return {
    database: candidate.database,
    engine: normalizeDatabaseEngine(candidate.engine),
    host: candidate.host,
    name: candidate.name,
    port: candidate.port,
    sslMode: candidate.sslMode ?? "Prefer",
    user: candidate.user,
  };
}
