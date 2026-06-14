import { Activity, KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { testPostgresConnection, type StoredConnectionDraft } from "../../databaraService";
import type { ConnectionDraft } from "../../types";
import { useDialogs } from "../../workspaceCore";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
} from "../ui";
import {
  buildConnectionDraft,
  connectionDisplayName,
  readErrorMessage,
  type ConnectionFormDraft,
} from "./connectionForm";

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

function ConnectionDialog({
  initialDraft,
  onClose,
  onSave,
}: {
  initialDraft: StoredConnectionDraft | null;
  onClose: () => void;
  onSave: (draft: ConnectionDraft) => Promise<void>;
}) {
  const defaultDraft: ConnectionFormDraft = {
    database: "",
    host: "",
    name: "",
    password: "",
    port: "",
    sslMode: "Prefer",
    user: "",
  };
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConnectionFormDraft>({
    ...defaultDraft,
    ...(initialDraft
      ? {
          ...initialDraft,
          port: String(initialDraft.port),
        }
      : null),
  });

  function updateDraft(key: keyof ConnectionFormDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function testConnection() {
    setTestResult(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setTestResult(readErrorMessage(error));
      return;
    }

    setTesting(true);
    try {
      const result = await testPostgresConnection({
        ...nextDraft,
        name: connectionDisplayName(nextDraft),
      });
      setTestResult(result.message);
    } catch (error) {
      setTestResult(readErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    setTestResult(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setTestResult(readErrorMessage(error));
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...nextDraft, name: connectionDisplayName(nextDraft) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame maxWidth="max-w-[540px]">
      <DialogHeader
        title={
          <>
            <KeyRound size={16} className="text-primary" />
            PostgreSQL connection
          </>
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveConnection();
        }}
      >
        <DialogBody className="grid grid-cols-2 gap-3">
          <Field
            label="Host"
            value={draft.host}
            onChange={(value) => updateDraft("host", value)}
            placeholder="localhost"
            autoFocus
          />
          <Field
            label="Port"
            value={draft.port}
            onChange={(value) => updateDraft("port", value)}
            placeholder="5432"
          />
          <Field
            label="Database"
            value={draft.database}
            onChange={(value) => updateDraft("database", value)}
            placeholder="databara_dev"
          />
          <Field
            label="User"
            value={draft.user}
            onChange={(value) => updateDraft("user", value)}
            placeholder="postgres"
          />
          <Field
            label="Password"
            value={draft.password}
            onChange={(value) => updateDraft("password", value)}
            type="password"
            placeholder="Enter password"
          />
          <label className="grid gap-1.5 text-[12px] text-muted-foreground">
            SSL mode
            <select
              value={draft.sslMode}
              onChange={(event) => updateDraft("sslMode", event.target.value)}
              className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary"
            >
              <option>Prefer</option>
              <option>Require</option>
              <option>Disable</option>
            </select>
          </label>
          <div className="col-span-2 min-h-6 text-[12px]">
            {testResult ? (
              <span className="text-emerald-300">{testResult}</span>
            ) : (
              <span className="text-muted-foreground">
                Password is used for this session only and is not saved.
              </span>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing || saving}
            className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Test connection
          </button>
          <button
            type="submit"
            disabled={testing || saving}
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

function PasswordConnectionDialog({
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
              {connection.user}@{connection.host}:{connection.port}
            </div>
            <div>Enter the password for this session.</div>
          </div>
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            className="col-span-1"
            placeholder="Enter password"
            autoFocus
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

function DeleteConnectionDialog({
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

function UnsavedTabsDialog({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            <Save size={16} className="shrink-0 text-primary" />
            <span className="truncate">Unsaved tabs</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>There are SQL tabs with unsaved changes.</div>
        <div>Save them before closing the app?</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          Cancel
        </button>
        <button onClick={onDiscard} className="control h-8 rounded px-3 text-[12px]">
          Don&apos;t save
        </button>
        <button
          onClick={onSave}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
        >
          <Save size={14} />
          Save
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
