import { HardDrive, HardDriveDownload, HardDriveUpload, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getBrowserStorageEstimate } from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import { fetchLatestReleaseVersion } from "../../updaterService";

export function StatusBar({
  onCheckForUpdates,
  onOpenStorage,
  onLoadConfiguration,
  onDownloadConfiguration,
  hasStoredConnections,
}: {
  onCheckForUpdates: () => void;
  onOpenStorage: () => void;
  onLoadConfiguration: () => void;
  onDownloadConfiguration: () => void;
  hasStoredConnections: boolean;
}) {
  const { t } = useI18n();
  const [version, setVersion] = useState("");
  // Percentage of the WebView storage quota in use (same source as the Storage
  // settings tab). null until measured / when the estimate API is unavailable.
  const [usedPercent, setUsedPercent] = useState<number | null>(null);

  useEffect(() => {
    void fetchLatestReleaseVersion().then((latest) => setVersion(latest ?? ""));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getBrowserStorageEstimate().then((estimate) => {
      if (cancelled || !estimate || estimate.quota <= 0) return;
      setUsedPercent(Math.min(100, Math.round((estimate.usage / estimate.quota) * 100)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="chrome-panel flex h-6 shrink-0 items-center justify-between border-t border-border px-1.5 text-[11px] text-muted-foreground">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenStorage}
          title={t("statusBar.storageUsed")}
          aria-label={t("statusBar.storageUsed")}
          className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <HardDrive size={12} className="shrink-0" />
          {usedPercent !== null ? (
            <span className="whitespace-nowrap tabular-nums leading-none">
              {t("statusBar.storagePercentUsed", { percent: usedPercent })}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onLoadConfiguration}
          title={t("statusBar.loadConfiguration")}
          aria-label={t("statusBar.loadConfiguration")}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <HardDriveUpload size={12} />
        </button>
        {hasStoredConnections ? (
          <button
            type="button"
            onClick={onDownloadConfiguration}
            title={t("statusBar.downloadConfiguration")}
            aria-label={t("statusBar.downloadConfiguration")}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <HardDriveDownload size={12} />
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {version ? <span className="whitespace-nowrap leading-none">v{version}</span> : null}
        <button
          type="button"
          onClick={onCheckForUpdates}
          title={t("statusBar.checkForUpdates")}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={12} />
        </button>
      </div>
    </footer>
  );
}
