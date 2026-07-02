import { Database, HardDriveDownload, HardDriveUpload, Plus, Settings } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";

export function TopBar({
  onNewConnection,
  onLoadConfiguration,
  onDownloadConfiguration,
  onOpenSettings,
  hasStoredConnections,
}: {
  onNewConnection: () => void;
  onLoadConfiguration: () => void;
  onDownloadConfiguration: () => void;
  onOpenSettings: () => void;
  hasStoredConnections: boolean;
}) {
  const { t } = useI18n();
  return (
    <header className="chrome-panel flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 text-primary">
          <Database size={16} />
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Databara
          </div>
          <div className="text-[13px] text-foreground">{t("topBar.tagline")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewConnection}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={14} />
          {t("topBar.newConnection")}
        </button>
        <button
          type="button"
          onClick={onLoadConfiguration}
          title={t("topBar.loadConfiguration")}
          className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
        >
          <HardDriveUpload size={14} />
          {t("topBar.loadConfiguration")}
        </button>
        {hasStoredConnections ? (
          <button
            type="button"
            onClick={onDownloadConfiguration}
            title={t("topBar.downloadConfiguration")}
            className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
          >
            <HardDriveDownload size={14} />
            {t("topBar.downloadConfiguration")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenSettings}
          title={t("topBar.settings")}
          className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
        >
          <Settings size={14} />
          {t("topBar.settings")}
        </button>
      </div>
    </header>
  );
}
