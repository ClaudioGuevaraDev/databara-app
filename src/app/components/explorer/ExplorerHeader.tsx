import { Plus, Upload } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { useExplorer } from "../../workspace/workspaceCore";
import { IconButton } from "../ui";

export function ExplorerHeader() {
  const { t } = useI18n();
  const { openNewConnectionDialog, openLoadConfigDialog } = useExplorer();

  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("explorer.title")}
      </div>
      <div className="flex items-center">
        <IconButton title={t("explorer.newConnection")} onClick={openNewConnectionDialog}>
          <Plus size={14} />
        </IconButton>
        <IconButton title={t("explorer.loadConfiguration")} onClick={openLoadConfigDialog}>
          <Upload size={14} />
        </IconButton>
      </div>
    </div>
  );
}
