import { useDialogs } from "../../workspace/workspaceCore";
import { ConnectionDialog } from "./ConnectionDialog";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { PasswordConnectionDialog } from "./PasswordConnectionDialog";
import { UnsavedTabsDialog } from "./UnsavedTabsDialog";

export function DialogsHost() {
  const dialogs = useDialogs();

  return (
    <>
      {dialogs.connectionDialogOpen ? (
        <ConnectionDialog
          initialDraft={dialogs.dialogInitialDraft}
          onClose={() => dialogs.setConnectionDialogOpen(false)}
          onSave={dialogs.saveConnection}
        />
      ) : null}
      {dialogs.passwordConnection ? (
        <PasswordConnectionDialog
          connection={dialogs.passwordConnection}
          onClose={dialogs.closePasswordDialog}
          onConnect={dialogs.connectStoredConnection}
        />
      ) : null}
      {dialogs.deleteConnectionRequest ? (
        <DeleteConnectionDialog
          connection={dialogs.deleteConnectionRequest}
          onCancel={dialogs.closeDeleteConnectionDialog}
          onConfirm={dialogs.confirmDeleteConnection}
        />
      ) : null}
      {dialogs.unsavedTabsDialogOpen ? (
        <UnsavedTabsDialog
          onCancel={dialogs.closeUnsavedTabsDialog}
          onDiscard={() => void dialogs.closeWindowAfterResolution("discard")}
          onSave={() => void dialogs.closeWindowAfterResolution("save")}
        />
      ) : null}
    </>
  );
}
