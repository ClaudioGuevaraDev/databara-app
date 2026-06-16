import { cn } from "../../lib/utils";
import { DialogsHost } from "../components/dialogs/DialogsHost";
import { Explorer } from "../components/explorer/Explorer";
import { StatusBar } from "../components/layout/StatusBar";
import { TopBar } from "../components/layout/TopBar";
import { ObjectDetailsPanel } from "../components/object-details/ObjectDetailsPanel";
import { MainWorkspace } from "../components/workspace/MainWorkspace";
import { useWorkspaceLayout } from "./workspaceCore";

export function WorkspaceShell() {
  const workspace = useWorkspaceLayout();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-[13px] text-foreground">
      <TopBar onNewConnection={workspace.openNewConnectionDialog} />
      <div
        className={cn(
          "grid min-h-0 flex-1",
          workspace.requiresConnection
            ? "grid-cols-[288px_minmax(560px,1fr)]"
            : "grid-cols-[288px_minmax(560px,1fr)_336px]",
        )}
      >
        <Explorer />
        <MainWorkspace requiresConnection={workspace.requiresConnection} />
        {workspace.requiresConnection ? null : <ObjectDetailsPanel />}
      </div>
      <StatusBar activeConnection={workspace.activeConnection} />
      <DialogsHost />
    </div>
  );
}
