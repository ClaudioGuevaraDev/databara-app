import { Pencil } from "lucide-react";
import { useState } from "react";
import type { RenameServerRequest } from "../../workspace/workspaceCore";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
} from "../ui";

export function RenameServerDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: RenameServerRequest;
  onCancel: () => void;
  onConfirm: (serverId: string, name: string) => void;
}) {
  const [name, setName] = useState(request.currentName);
  const hostPort = `${request.host}:${request.port}`;

  function submit() {
    onConfirm(request.serverId, name);
  }

  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <Pencil size={16} className="shrink-0 text-primary" />
            <span className="truncate">Rename server</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
          <Field
            autoFocus
            label="Server name"
            value={name}
            onChange={setName}
            placeholder={hostPort}
          />
          <div>
            Leave it empty to revert to{" "}
            <span className="font-mono text-foreground">{hostPort}</span>.
          </div>
        </DialogBody>
        <DialogActions>
          <button type="button" onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
          >
            <Pencil size={14} />
            Save
          </button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}
