import { useEffect } from "react";
import { I18nProvider } from "../i18n/I18nProvider";
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
      <I18nProvider>
        <WorkspaceShell />
      </I18nProvider>
    </WorkspaceProvider>
  );
}
