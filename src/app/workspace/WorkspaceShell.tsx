import { DialogsHost } from "../components/dialogs/DialogsHost";
import { Explorer } from "../components/explorer/Explorer";
import { StatusBar } from "../components/layout/StatusBar";
import { TopBar } from "../components/layout/TopBar";
import { MainWorkspace } from "../components/workspace/MainWorkspace";
import { useWorkspaceLayout } from "./workspaceCore";

export function WorkspaceShell() {
  const workspace = useWorkspaceLayout();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-[13px] text-foreground">
      <TopBar onNewConnection={workspace.openNewConnectionDialog} />
      <div className="grid min-h-0 flex-1 grid-cols-[288px_minmax(560px,1fr)]">
        <Explorer />
        <MainWorkspace requiresConnection={workspace.requiresConnection} />
      </div>
      <StatusBar activeConnection={workspace.activeConnection} />
      <DialogsHost />
    </div>
  );
}
