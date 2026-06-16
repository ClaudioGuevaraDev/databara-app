import { Activity, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { testPostgresConnection, type StoredConnectionDraft } from "../../databaraService";
import type { ConnectionDraft } from "../../types";
import {
  buildConnectionDraft,
  connectionDisplayName,
  readErrorMessage,
  type ConnectionFormDraft,
} from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
} from "../ui";

export function ConnectionDialog({
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
            autoFocus
            label="Host"
            onChange={(value) => updateDraft("host", value)}
            placeholder="localhost"
            value={draft.host}
          />
          <Field
            label="Port"
            onChange={(value) => updateDraft("port", value)}
            placeholder="5432"
            value={draft.port}
          />
          <Field
            label="Database"
            onChange={(value) => updateDraft("database", value)}
            placeholder="databara_dev"
            value={draft.database}
          />
          <Field
            label="User"
            onChange={(value) => updateDraft("user", value)}
            placeholder="postgres"
            value={draft.user}
          />
          <Field
            label="Password"
            onChange={(value) => updateDraft("password", value)}
            placeholder="Enter password"
            type="password"
            value={draft.password}
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
