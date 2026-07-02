import { HardDriveUpload, Plus } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { useExplorer } from "../../workspace/workspaceCore";

export function ExplorerHeader() {
  const { t } = useI18n();
  const { openNewConnectionDialog, openLoadConfigDialog } = useExplorer();

  return (
    <div className="flex items-center gap-1.5 border-b border-border p-1.5">
      <button
        type="button"
        onClick={openNewConnectionDialog}
        className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-primary/25 bg-[hsl(var(--primary)/0.08)] text-[12px] font-semibold text-primary transition-colors hover:bg-[hsl(var(--primary)/0.14)]"
      >
        <Plus size={14} className="shrink-0" />
        <span className="truncate">{t("explorer.newConnection")}</span>
      </button>
      <button
        type="button"
        onClick={openLoadConfigDialog}
        className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-border text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <HardDriveUpload size={14} className="shrink-0" />
        <span className="truncate">{t("explorer.loadConfiguration")}</span>
      </button>
    </div>
  );
}
