import { useState } from "react";
import { DialogsHost } from "../components/dialogs/DialogsHost";
import { Explorer } from "../components/explorer/Explorer";
import { StatusBar } from "../components/layout/StatusBar";
import { TopBar } from "../components/layout/TopBar";
import { ResizeHandle } from "../components/ui";
import { Toaster } from "../components/ui/Toaster";
import { MainWorkspace } from "../components/workspace/MainWorkspace";
import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from "../databaraService";
import { useI18n } from "../i18n/I18nContext";
import { useSettings, useWorkspaceLayout } from "./workspaceCore";

export function WorkspaceShell() {
  const { t } = useI18n();
  const workspace = useWorkspaceLayout();
  const { settings, setSidebarWidth } = useSettings();
  // Live width while dragging; falls back to the persisted setting at rest so
  // localStorage is only written once, on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const sidebarWidth = dragWidth ?? settings.sidebarWidth.width;
  // With no saved connections there's nothing to explore, so hide the sidebar and
  // let the empty state fill the width.
  const showSidebar = workspace.hasStoredConnections;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-[13px] text-foreground">
      <TopBar
        onNewConnection={workspace.openNewConnectionDialog}
        onLoadConfiguration={workspace.openLoadConfigDialog}
        onDownloadConfiguration={workspace.openStorageSettings}
        onOpenSettings={workspace.openSettingsDialog}
      />
      <div
        className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
        style={{
          gridTemplateColumns: showSidebar ? `${sidebarWidth}px minmax(0,1fr)` : "minmax(0,1fr)",
        }}
      >
        {showSidebar ? <Explorer /> : null}
        <MainWorkspace
          requiresConnection={workspace.requiresConnection}
          autoReconnecting={workspace.autoReconnecting}
        />
        {/* Overlaid on the sidebar/content boundary so it doesn't consume layout width. */}
        {showSidebar ? (
          <ResizeHandle
            axis="x"
            ariaLabel={t("workspace.resizeSidebar")}
            value={sidebarWidth}
            min={SIDEBAR_WIDTH_MIN}
            max={SIDEBAR_WIDTH_MAX}
            onResize={setDragWidth}
            onCommit={(next) => {
              setSidebarWidth(next);
              setDragWidth(null);
            }}
            className="absolute bottom-0 top-0 -translate-x-1/2"
            style={{ left: sidebarWidth }}
          />
        ) : null}
      </div>
      <StatusBar
        onCheckForUpdates={() => void workspace.checkForUpdates({ silent: false })}
        onOpenStorage={workspace.openStorageSettings}
        onLoadConfiguration={workspace.openLoadConfigDialog}
        onDownloadConfiguration={workspace.openStorageSettings}
      />
      <DialogsHost />
      <Toaster />
    </div>
  );
}
