import { Save } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

export function UnsavedTabsDialog({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            <Save size={16} className="shrink-0 text-primary" />
            <span className="truncate">{t("dialogs.unsavedTabs.title")}</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>{t("dialogs.unsavedTabs.line1")}</div>
        <div>{t("dialogs.unsavedTabs.line2")}</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          {t("common.cancel")}
        </button>
        <button onClick={onDiscard} className="control h-8 rounded px-3 text-[12px]">
          {t("dialogs.unsavedTabs.dontSave")}
        </button>
        <button
          onClick={onSave}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
        >
          <Save size={14} />
          {t("dialogs.unsavedTabs.save")}
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
