import { useEffect } from "react";
import { useDialogs, useSettings, useUpdater } from "../../workspace/workspaceCore";
import { AddDatabaseDialog } from "./AddDatabaseDialog";
import { ConnectionDialog } from "./ConnectionDialog";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { DeleteServerDialog } from "./DeleteServerDialog";
import { PasswordConnectionDialog } from "./PasswordConnectionDialog";
import { RenameServerDialog } from "./RenameServerDialog";
import { SettingsDialog } from "./SettingsDialog";
import { UnsavedTabsDialog } from "./UnsavedTabsDialog";
import { UpdateDialog } from "./UpdateDialog";

export function DialogsHost() {
  const dialogs = useDialogs();
  const { settingsDialogOpen, closeSettingsDialog } = useSettings();
  const { updateDialogOpen, updateProgress, dismissUpdateDialog, openDownloadPage } = useUpdater();
  const {
    addDatabaseRequest,
    closeAddDatabaseDialog,
    closeDeleteConnectionDialog,
    closeDeleteServerDialog,
    closeRenameServerDialog,
    closePasswordDialog,
    closeUnsavedTabsDialog,
    connectionDialogOpen,
    deleteConnectionRequest,
    deleteServerRequest,
    renameServerRequest,
    dialogInitialDraft,
    passwordConnection,
    saveConnection,
    setConnectionDialogOpen,
    unsavedTabsDialogOpen,
    closeWindowAfterResolution,
    confirmAddDatabase,
    confirmDeleteConnection,
    confirmDeleteServer,
    confirmRenameServer,
    connectStoredConnection,
  } = dialogs;

  useEffect(() => {
    function closeTopmostDialog() {
      if (unsavedTabsDialogOpen) {
        closeUnsavedTabsDialog();
        return;
      }

      if (deleteServerRequest) {
        closeDeleteServerDialog();
        return;
      }

      if (renameServerRequest) {
        closeRenameServerDialog();
        return;
      }

      if (addDatabaseRequest) {
        closeAddDatabaseDialog();
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

      if (settingsDialogOpen) {
        closeSettingsDialog();
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
        !deleteServerRequest &&
        !renameServerRequest &&
        !addDatabaseRequest &&
        !deleteConnectionRequest &&
        !passwordConnection &&
        !settingsDialogOpen &&
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
    addDatabaseRequest,
    closeAddDatabaseDialog,
    closeDeleteConnectionDialog,
    closeDeleteServerDialog,
    closeRenameServerDialog,
    closePasswordDialog,
    closeSettingsDialog,
    closeUnsavedTabsDialog,
    connectionDialogOpen,
    deleteConnectionRequest,
    deleteServerRequest,
    renameServerRequest,
    passwordConnection,
    settingsDialogOpen,
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
      {renameServerRequest ? (
        <RenameServerDialog
          request={renameServerRequest}
          onCancel={closeRenameServerDialog}
          onConfirm={confirmRenameServer}
        />
      ) : null}
      {deleteServerRequest ? (
        <DeleteServerDialog
          request={deleteServerRequest}
          onCancel={closeDeleteServerDialog}
          onConfirm={confirmDeleteServer}
        />
      ) : null}
      {addDatabaseRequest ? (
        <AddDatabaseDialog
          request={addDatabaseRequest}
          onCancel={closeAddDatabaseDialog}
          onConfirm={confirmAddDatabase}
        />
      ) : null}
      {unsavedTabsDialogOpen ? (
        <UnsavedTabsDialog
          onCancel={closeUnsavedTabsDialog}
          onDiscard={() => void closeWindowAfterResolution("discard")}
          onSave={() => void closeWindowAfterResolution("save")}
        />
      ) : null}
      {settingsDialogOpen ? <SettingsDialog onClose={closeSettingsDialog} /> : null}
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
