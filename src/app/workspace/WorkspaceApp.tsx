import { useEffect } from "react";
import { WorkspaceProvider } from "./workspaceContext";
import { WorkspaceShell } from "./WorkspaceShell";

export function WorkspaceApp() {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
