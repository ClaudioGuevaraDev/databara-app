import { useEffect } from "react";
import { useDialogs, useUpdater } from "../../workspace/workspaceCore";
import { ConnectionDialog } from "./ConnectionDialog";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { PasswordConnectionDialog } from "./PasswordConnectionDialog";
import { UnsavedTabsDialog } from "./UnsavedTabsDialog";
import { UpdateDialog } from "./UpdateDialog";

export function DialogsHost() {
  const dialogs = useDialogs();
  const { updateDialogOpen, updateProgress, dismissUpdateDialog, openDownloadPage } = useUpdater();
  const {
    closeDeleteConnectionDialog,
    closePasswordDialog,
    closeUnsavedTabsDialog,
    connectionDialogOpen,
    deleteConnectionRequest,
    dialogInitialDraft,
    passwordConnection,
    saveConnection,
    setConnectionDialogOpen,
    unsavedTabsDialogOpen,
    closeWindowAfterResolution,
    confirmDeleteConnection,
    connectStoredConnection,
  } = dialogs;

  useEffect(() => {
    function closeTopmostDialog() {
      if (unsavedTabsDialogOpen) {
        closeUnsavedTabsDialog();
        return;
      }

      if (deleteConnectionRequest) {
        closeDeleteConnectionDialog();
        return;
      }

      if (passwordConnection) {
        closePasswordDialog();
        return;
      }

      if (connectionDialogOpen) {
        setConnectionDialogOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (
        !unsavedTabsDialogOpen &&
        !deleteConnectionRequest &&
        !passwordConnection &&
        !connectionDialogOpen
      ) {
        return;
      }

      event.preventDefault();
      closeTopmostDialog();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeDeleteConnectionDialog,
    closePasswordDialog,
    closeUnsavedTabsDialog,
    connectionDialogOpen,
    deleteConnectionRequest,
    passwordConnection,
    setConnectionDialogOpen,
    unsavedTabsDialogOpen,
  ]);

  return (
    <>
      {connectionDialogOpen ? (
        <ConnectionDialog
          initialDraft={dialogInitialDraft}
          onClose={() => setConnectionDialogOpen(false)}
          onSave={saveConnection}
        />
      ) : null}
      {passwordConnection ? (
        <PasswordConnectionDialog
          connection={passwordConnection}
          onClose={closePasswordDialog}
          onConnect={connectStoredConnection}
        />
      ) : null}
      {deleteConnectionRequest ? (
        <DeleteConnectionDialog
          connection={deleteConnectionRequest}
          onCancel={closeDeleteConnectionDialog}
          onConfirm={confirmDeleteConnection}
        />
      ) : null}
      {unsavedTabsDialogOpen ? (
        <UnsavedTabsDialog
          onCancel={closeUnsavedTabsDialog}
          onDiscard={() => void closeWindowAfterResolution("discard")}
          onSave={() => void closeWindowAfterResolution("save")}
        />
      ) : null}
      {updateDialogOpen && updateProgress ? (
        <UpdateDialog
          progress={updateProgress}
          onDismiss={dismissUpdateDialog}
          onDownloadManually={openDownloadPage}
        />
      ) : null}
    </>
  );
}
