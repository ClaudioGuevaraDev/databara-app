import { useEffect } from "react";
import { useBackup, useDialogs, useSettings, useUpdater } from "../../workspace/workspaceCore";
import { AddDatabaseDialog } from "./AddDatabaseDialog";
import { ConnectionDialog } from "./ConnectionDialog";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { DeleteServerDialog } from "./DeleteServerDialog";
import { DownloadBackupDialog } from "./DownloadBackupDialog";
import { LoadConfigDialog } from "./LoadConfigDialog";
import { PasswordConnectionDialog } from "./PasswordConnectionDialog";
import { RenameServerDialog } from "./RenameServerDialog";
import { SettingsDialog } from "./SettingsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { UnsavedTabsDialog } from "./UnsavedTabsDialog";
import { UpdateDialog } from "./UpdateDialog";

export function DialogsHost() {
  const dialogs = useDialogs();
  const { backupRequest, closeBackupDialog, chooseBackupDirectory, runBackup } = useBackup();
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
    loadConfigDialogOpen,
    closeLoadConfigDialog,
    shortcutsDialogOpen,
    closeShortcutsDialog,
    closeWindowAfterResolution,
    confirmAddDatabase,
    confirmDeleteConnection,
    confirmDeleteServer,
    confirmRenameServer,
    connectStoredConnection,
  } = dialogs;

  useEffect(() => {
    function closeTopmostDialog() {
      if (shortcutsDialogOpen) {
        closeShortcutsDialog();
        return;
      }

      if (loadConfigDialogOpen) {
        closeLoadConfigDialog();
        return;
      }

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

      if (backupRequest) {
        closeBackupDialog();
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
        !shortcutsDialogOpen &&
        !loadConfigDialogOpen &&
        !unsavedTabsDialogOpen &&
        !deleteServerRequest &&
        !renameServerRequest &&
        !addDatabaseRequest &&
        !backupRequest &&
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
    backupRequest,
    closeBackupDialog,
    closeAddDatabaseDialog,
    closeDeleteConnectionDialog,
    closeDeleteServerDialog,
    closeRenameServerDialog,
    closePasswordDialog,
    closeSettingsDialog,
    closeUnsavedTabsDialog,
    closeLoadConfigDialog,
    connectionDialogOpen,
    deleteConnectionRequest,
    deleteServerRequest,
    renameServerRequest,
    passwordConnection,
    settingsDialogOpen,
    setConnectionDialogOpen,
    unsavedTabsDialogOpen,
    loadConfigDialogOpen,
    shortcutsDialogOpen,
    closeShortcutsDialog,
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
      {backupRequest ? (
        <DownloadBackupDialog
          request={backupRequest}
          onClose={closeBackupDialog}
          onChooseDirectory={chooseBackupDirectory}
          onDownload={runBackup}
        />
      ) : null}
      {settingsDialogOpen ? <SettingsDialog onClose={closeSettingsDialog} /> : null}
      {shortcutsDialogOpen ? <ShortcutsDialog onClose={closeShortcutsDialog} /> : null}
      {loadConfigDialogOpen ? <LoadConfigDialog onClose={closeLoadConfigDialog} /> : null}
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
