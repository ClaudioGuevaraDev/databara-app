import { useEffect, useRef } from "react";
import { ZOOM_STEP } from "../databaraService";
import {
  useObjectDetailsPanel,
  useResults,
  useSettings,
  useSqlEditor,
  useWorkspaceLayout,
} from "./workspaceCore";

// App-wide keyboard shortcuts. Mounted once from WorkspaceShell (inside the
// workspace + i18n providers). The editor-scoped Ctrl+Enter/Ctrl+S bindings are
// owned by Monaco (see TabsEditor); this hook covers everything else and lets
// Run work even when the editor isn't focused. Monaco stops propagation of its
// own commands while focused, so Run doesn't double-fire.
//
// Ctrl+S is intentionally NOT handled here — a dedicated global listener in
// WorkspaceProvider already saves the active tab.
export function useGlobalShortcuts() {
  const { settings, setZoomLevel } = useSettings();
  const { runQuery, closeSqlTab, selectSqlTab, sqlTabs, activeTabId } = useSqlEditor();
  const { goToQueryPage, queryPagination, copyResult } = useResults();
  const { refreshAll } = useObjectDetailsPanel();
  const { openNewConnectionDialog, openLoadConfigDialog, openSettingsDialog, openShortcutsDialog } =
    useWorkspaceLayout();

  // Keep the latest handler in a ref so the window listener is registered only
  // once but always sees current state/actions (no stale closures).
  const handlerRef = useRef<(event: KeyboardEvent) => void>(() => {});

  function handleKeyDown(event: KeyboardEvent) {
    // F5 runs the query regardless of modifiers (common in SQL clients).
    if (event.key === "F5") {
      event.preventDefault();
      void runQuery();
      return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;

    const key = event.key;
    const lower = key.toLowerCase();

    // Zoom — tolerate Shift because "+" and "_" are shifted on many layouts.
    if (!event.altKey && (key === "=" || key === "+")) {
      event.preventDefault();
      setZoomLevel(settings.zoom.level + ZOOM_STEP);
      return;
    }
    if (!event.altKey && (key === "-" || key === "_")) {
      event.preventDefault();
      setZoomLevel(settings.zoom.level - ZOOM_STEP);
      return;
    }
    if (!event.altKey && !event.shiftKey && key === "0") {
      event.preventDefault();
      setZoomLevel(100);
      return;
    }

    // Ctrl/Cmd + Alt — tab and results-page navigation.
    if (event.altKey) {
      if (key === "ArrowRight" || key === "ArrowLeft") {
        if (sqlTabs.length === 0) return;
        const index = sqlTabs.findIndex((tab) => tab.id === activeTabId);
        if (index === -1) return;
        const delta = key === "ArrowRight" ? 1 : -1;
        const next = sqlTabs[(index + delta + sqlTabs.length) % sqlTabs.length];
        event.preventDefault();
        selectSqlTab(next.id);
      } else if (key === "ArrowDown" || key === "ArrowUp") {
        if (!queryPagination) return;
        event.preventDefault();
        const delta = key === "ArrowDown" ? 1 : -1;
        void goToQueryPage(queryPagination.page + delta);
      }
      return;
    }

    // Ctrl/Cmd + Shift — results / explorer.
    if (event.shiftKey) {
      if (lower === "c") {
        event.preventDefault();
        void copyResult();
      } else if (lower === "r") {
        // Prevent the webview's reload on Ctrl+Shift+R.
        event.preventDefault();
        void refreshAll();
      }
      return;
    }

    // Ctrl/Cmd (no Shift/Alt).
    switch (lower) {
      case "enter":
        event.preventDefault();
        void runQuery();
        break;
      case "n":
        event.preventDefault();
        openNewConnectionDialog();
        break;
      case "o":
        event.preventDefault();
        openLoadConfigDialog();
        break;
      case ",":
        event.preventDefault();
        openSettingsDialog();
        break;
      case "/":
        event.preventDefault();
        openShortcutsDialog();
        break;
      case "w":
        if (!activeTabId) return;
        event.preventDefault();
        closeSqlTab(activeTabId);
        break;
      default:
        break;
    }
  }

  // Sync the ref after each render (never during render) so the once-registered
  // window listener always calls the latest handler without stale closures.
  useEffect(() => {
    handlerRef.current = handleKeyDown;
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
