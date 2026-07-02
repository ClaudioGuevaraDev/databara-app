import { HardDriveDownload, HardDriveUpload, Plus } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { useExplorer } from "../../workspace/workspaceCore";
import { IconButton } from "../ui";

export function ExplorerHeader() {
  const { t } = useI18n();
  const { openNewConnectionDialog, openLoadConfigDialog, openStorageSettings } = useExplorer();

  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("explorer.title")}
      </div>
      <div className="flex items-center">
        <IconButton
          title={t("explorer.newConnection")}
          onClick={openNewConnectionDialog}
          className="h-5 w-5 hover:bg-transparent"
        >
          <Plus size={12} />
        </IconButton>
        <IconButton
          title={t("explorer.loadConfiguration")}
          onClick={openLoadConfigDialog}
          className="h-5 w-5 hover:bg-transparent"
        >
          <HardDriveUpload size={12} />
        </IconButton>
        <IconButton
          title={t("explorer.downloadConfiguration")}
          onClick={openStorageSettings}
          className="h-5 w-5 hover:bg-transparent"
        >
          <HardDriveDownload size={12} />
        </IconButton>
      </div>
    </div>
  );
}
