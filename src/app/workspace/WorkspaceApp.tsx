import { WorkspaceProvider } from "./workspaceContext";
import { WorkspaceShell } from "./WorkspaceShell";

export function WorkspaceApp() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
