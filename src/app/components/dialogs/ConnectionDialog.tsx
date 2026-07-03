import { Activity, FolderOpen, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  connectionEngines,
  getConnectionEngineConfig,
  isFileEngine,
  normalizeDatabaseEngine,
} from "../../connectionEngines";
import {
  pickDatabaseFilePath,
  testPostgresConnection,
  type StoredConnectionDraft,
} from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import type { ConnectionDraft, DatabaseEngine, SslMode } from "../../types";
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
  FormAlert,
  SelectField,
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
  const { t } = useI18n();
  const defaultEngine = connectionEngines[0];
  const defaultDraft: ConnectionFormDraft = {
    database: "",
    engine: defaultEngine.id,
    filePath: "",
    host: "",
    name: "",
    password: "",
    port: "",
    sslMode: defaultEngine.defaultSslMode,
    user: "",
  };
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [draft, setDraft] = useState<ConnectionFormDraft>({
    ...defaultDraft,
    ...(initialDraft
      ? {
          ...initialDraft,
          engine: normalizeDatabaseEngine(initialDraft.engine),
          port: String(initialDraft.port),
        }
      : null),
  });
  const engineConfig = getConnectionEngineConfig(draft.engine);
  const isFile = isFileEngine(draft.engine);
  const engineOptions = connectionEngines.map((engine) => ({
    label: engine.label,
    value: engine.id,
  }));
  const sslModeOptions = engineConfig.sslModes.map((sslMode) => ({
    label: sslMode,
    value: sslMode,
  }));

  function updateDraft(key: keyof ConnectionFormDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function browseForFile() {
    const path = await pickDatabaseFilePath();
    if (path) updateDraft("filePath", path);
  }

  function updateEngine(engine: DatabaseEngine) {
    const nextConfig = getConnectionEngineConfig(engine);
    setDraft((current) => ({
      ...current,
      engine,
      sslMode: nextConfig.sslModes.includes(current.sslMode)
        ? current.sslMode
        : nextConfig.defaultSslMode,
    }));
  }

  async function testConnection() {
    setFormMessage(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setFormMessage({ text: readErrorMessage(error), tone: "error" });
      return;
    }

    setTesting(true);
    try {
      const result = await testPostgresConnection({
        ...nextDraft,
        name: connectionDisplayName(nextDraft),
      });
      setFormMessage({ text: result.message, tone: result.ok ? "success" : "error" });
    } catch (error) {
      setFormMessage({ text: readErrorMessage(error), tone: "error" });
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    setFormMessage(null);
    let nextDraft: ConnectionDraft;
    try {
      nextDraft = buildConnectionDraft(draft);
    } catch (error) {
      setFormMessage({ text: readErrorMessage(error), tone: "error" });
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
            {t("dialogs.connection.title")}
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
          <SelectField<DatabaseEngine>
            className="col-span-2"
            label={t("dialogs.connection.engine")}
            onChange={updateEngine}
            options={engineOptions}
            value={draft.engine}
          />
          {isFile ? (
            <div className="col-span-2 flex items-end gap-2">
              <Field
                autoFocus
                className="flex-1"
                label={t("dialogs.connection.filePath")}
                onChange={(value) => updateDraft("filePath", value)}
                placeholder={engineConfig.placeholders.filePath}
                value={draft.filePath ?? ""}
              />
              <button
                type="button"
                onClick={() => void browseForFile()}
                className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
              >
                <FolderOpen size={14} />
                {t("dialogs.connection.browse")}
              </button>
            </div>
          ) : (
            <>
              <Field
                autoFocus
                label={t("dialogs.connection.host")}
                onChange={(value) => updateDraft("host", value)}
                placeholder={engineConfig.placeholders.host}
                value={draft.host}
              />
              <Field
                label={t("dialogs.connection.port")}
                onChange={(value) => updateDraft("port", value)}
                placeholder={String(engineConfig.defaultPort)}
                value={draft.port}
              />
              <Field
                label={t("dialogs.connection.user")}
                onChange={(value) => updateDraft("user", value)}
                placeholder={engineConfig.placeholders.user}
                value={draft.user}
              />
              <Field
                label={t("dialogs.connection.password")}
                onChange={(value) => updateDraft("password", value)}
                placeholder={t("dialogs.connection.passwordPlaceholder")}
                type="password"
                value={draft.password}
              />
              <Field
                label={t("dialogs.connection.database")}
                onChange={(value) => updateDraft("database", value)}
                placeholder={engineConfig.placeholders.database}
                value={draft.database}
              />
              {sslModeOptions.length > 0 ? (
                <SelectField<SslMode>
                  label={t("dialogs.connection.sslMode")}
                  onChange={(value) => updateDraft("sslMode", value)}
                  options={sslModeOptions}
                  value={draft.sslMode}
                />
              ) : null}
            </>
          )}
          <div className="col-span-2">
            {formMessage ? (
              <FormAlert tone={formMessage.tone}>{formMessage.text}</FormAlert>
            ) : (
              <p className="min-h-6 text-[12px] text-muted-foreground">
                {t("dialogs.connection.passwordHint")}
              </p>
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
            {t("dialogs.connection.test")}
          </button>
          <button
            type="submit"
            disabled={testing || saving}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {t("common.connect")}
          </button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}
