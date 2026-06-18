import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { connectionEngineLabel } from "../../connectionEngines";
import type { StoredConnectionDraft } from "../../databaraService";
import { readErrorMessage } from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
} from "../ui";

export function PasswordConnectionDialog({
  connection,
  onClose,
  onConnect,
}: {
  connection: StoredConnectionDraft;
  onClose: () => void;
  onConnect: (connection: StoredConnectionDraft, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      await onConnect(connection, password);
    } catch (connectError) {
      setError(readErrorMessage(connectError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <KeyRound size={16} className="shrink-0 text-primary" />
            <span className="truncate">Connect to {connection.database}</span>
          </>
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <DialogBody className="grid gap-3">
          <div className="grid gap-1 text-[12px] text-muted-foreground">
            <div className="truncate font-mono text-foreground">
              {connectionEngineLabel(connection.engine)} · {connection.user}@{connection.host}:
              {connection.port}
            </div>
            <div>Enter the password for this session.</div>
          </div>
          <Field
            autoFocus
            className="col-span-1"
            label="Password"
            onChange={setPassword}
            placeholder="Enter password"
            type="password"
            value={password}
          />
          <div className="min-h-5 text-[12px]">
            {error ? <span className="text-destructive">{error}</span> : null}
          </div>
        </DialogBody>
        <DialogActions>
          <button type="button" onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Connect
          </button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}
