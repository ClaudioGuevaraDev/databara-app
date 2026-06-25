import { Unlink } from "lucide-react";
import { connectionEngineLabel } from "../../connectionEngines";
import type { StoredConnectionDraft } from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
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
  const { t } = useI18n();
  return (
    <DialogFrame maxWidth="max-w-[420px]">
      <DialogHeader
        title={
          <>
            <Unlink size={16} className="shrink-0 text-amber-400" />
            <span className="truncate">{t("dialogs.deleteConnection.title")}</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>
          {t("dialogs.deleteConnection.question")}{" "}
          <span className="font-mono text-foreground">{connection.database}</span>?
        </div>
        <div className="truncate font-mono text-foreground">
          {connectionEngineLabel(connection.engine)} · {connection.user}@{connection.host}:
          {connection.port}
        </div>
        <div>{t("dialogs.deleteConnection.note")}</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          {t("common.cancel")}
        </button>
        <button
          onClick={() => onConfirm(connection)}
          className="flex h-8 items-center gap-1.5 rounded bg-amber-400 px-3 text-[12px] font-semibold text-[hsl(var(--background))] hover:brightness-110"
        >
          <Unlink size={14} />
          {t("dialogs.deleteConnection.confirm")}
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
