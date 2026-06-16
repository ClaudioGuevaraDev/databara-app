import { Trash2 } from "lucide-react";
import type { StoredConnectionDraft } from "../../databaraService";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

export function DeleteConnectionDialog({
  connection,
  onCancel,
  onConfirm,
}: {
  connection: StoredConnectionDraft;
  onCancel: () => void;
  onConfirm: (connection: StoredConnectionDraft) => void;
}) {
  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <Trash2 size={16} className="shrink-0 text-destructive" />
            <span className="truncate">Delete connection</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>
          Delete the saved connection for{" "}
          <span className="font-mono text-foreground">{connection.database}</span>?
        </div>
        <div className="truncate font-mono text-foreground">
          {connection.user}@{connection.host}:{connection.port}
        </div>
        <div>This removes the saved profile from this device.</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(connection)}
          className="flex h-8 items-center gap-1.5 rounded bg-destructive px-3 text-[12px] font-semibold text-destructive-foreground hover:brightness-110"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
