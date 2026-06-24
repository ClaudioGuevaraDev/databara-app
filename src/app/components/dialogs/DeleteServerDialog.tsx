import { Trash2 } from "lucide-react";
import type { DeleteServerRequest } from "../../workspace/workspaceCore";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

export function DeleteServerDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: DeleteServerRequest;
  onCancel: () => void;
  onConfirm: (serverId: string) => void;
}) {
  const hostPort = `${request.host}:${request.port}`;
  const count = request.connections.length;

  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <Trash2 size={16} className="shrink-0 text-destructive" />
            <span className="truncate">Delete server</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>
          Delete the server <span className="font-mono text-foreground">{hostPort}</span> and all{" "}
          {count} saved {count === 1 ? "database" : "databases"} under it?
        </div>
        {count > 0 ? (
          <ul className="grid max-h-40 gap-1 overflow-auto rounded border border-border bg-[hsl(var(--panel-soft))] p-2 font-mono text-foreground">
            {request.connections.map((connection) => (
              <li key={`${connection.database}:${connection.user}`} className="truncate">
                {connection.database}{" "}
                <span className="text-muted-foreground">· {connection.user}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div>This removes the saved profiles and their passwords from this device.</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(request.serverId)}
          className="flex h-8 items-center gap-1.5 rounded bg-destructive px-3 text-[12px] font-semibold text-destructive-foreground hover:brightness-110"
        >
          <Trash2 size={14} />
          Delete server
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
