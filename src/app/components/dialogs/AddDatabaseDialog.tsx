import { DatabaseIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import type { AddDatabaseRequest } from "../../workspace/workspaceCore";
import { readErrorMessage } from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
} from "../ui";

export function AddDatabaseDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: AddDatabaseRequest;
  onCancel: () => void;
  onConfirm: (serverId: string, database: string, password?: string) => Promise<void>;
}) {
  const [database, setDatabase] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostPort = `${request.host}:${request.port}`;

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(request.serverId, database, request.needsPassword ? password : undefined);
    } catch (addError) {
      setError(readErrorMessage(addError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <DatabaseIcon size={16} className="shrink-0 text-primary" />
            <span className="truncate">Add database</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <DialogBody className="grid gap-3">
          <div className="grid gap-1 text-[12px] text-muted-foreground">
            <div className="truncate font-mono text-foreground">{hostPort}</div>
            <div>Connect to another database on this server.</div>
          </div>
          <Field
            autoFocus
            label="Database name"
            value={database}
            onChange={setDatabase}
            placeholder="e.g. analytics"
          />
          {request.needsPassword ? (
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter password"
            />
          ) : null}
          <div className="min-h-5 text-[12px]">
            {error ? <span className="text-destructive">{error}</span> : null}
          </div>
        </DialogBody>
        <DialogActions>
          <button type="button" onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !database.trim()}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Add
          </button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}
