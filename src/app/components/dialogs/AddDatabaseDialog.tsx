import { DatabaseIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { AddDatabaseRequest } from "../../workspace/workspaceCore";
import { readErrorMessage } from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
  FormAlert,
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
  const { t } = useI18n();
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
            <span className="truncate">{t("dialogs.addDatabase.title")}</span>
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
            <div>{t("dialogs.addDatabase.hint")}</div>
          </div>
          <Field
            autoFocus
            label={t("dialogs.addDatabase.nameLabel")}
            value={database}
            onChange={setDatabase}
            placeholder={t("dialogs.addDatabase.namePlaceholder")}
          />
          {request.needsPassword ? (
            <Field
              label={t("dialogs.addDatabase.passwordLabel")}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t("dialogs.addDatabase.passwordPlaceholder")}
            />
          ) : null}
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        </DialogBody>
        <DialogActions>
          <button type="button" onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !database.trim()}
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
