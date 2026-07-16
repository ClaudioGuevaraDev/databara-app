import {
  Database,
  HardDriveDownload,
  HardDriveUpload,
  Keyboard,
  Plus,
  Settings,
} from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";

export function TopBar({
  onNewConnection,
  onLoadConfiguration,
  onDownloadConfiguration,
  onOpenSettings,
  onOpenShortcuts,
  hasStoredConnections,
}: {
  onNewConnection: () => void;
  onLoadConfiguration: () => void;
  onDownloadConfiguration: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  hasStoredConnections: boolean;
}) {
  const { t } = useI18n();
  return (
    <header className="chrome-panel flex h-11 shrink-0 select-none items-center justify-between border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary ring-1 ring-primary/20">
          <Database size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Databara
          </div>
          <div className="truncate text-[13px] text-foreground" title={t("topBar.tagline")}>
            {t("topBar.tagline")}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onNewConnection}
          className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Plus size={14} className="shrink-0" />
          {t("topBar.newConnection")}
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {/* Import / Export config as a segmented control; each button highlights
            individually. Export opens Storage settings and only shows with saved
            connections, in which case Import fills the pill on its own. */}
        <div className="flex h-8 items-center rounded border border-border bg-[hsl(var(--panel-soft)/0.82)]">
          <button
            type="button"
            onClick={onLoadConfiguration}
            title={t("topBar.loadConfiguration")}
            aria-label={t("topBar.loadConfiguration")}
            className={`flex h-full items-center px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
              hasStoredConnections ? "rounded-l" : "rounded"
            }`}
          >
            <HardDriveUpload size={14} />
          </button>
          {hasStoredConnections ? (
            <>
              <span className="h-5 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={onDownloadConfiguration}
                title={t("topBar.downloadConfiguration")}
                aria-label={t("topBar.downloadConfiguration")}
                className="flex h-full items-center rounded-r px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <HardDriveDownload size={14} />
              </button>
            </>
          ) : null}
        </div>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {/* Settings / Shortcuts as a segmented control, matching the import/export
            pill above so all secondary toolbar buttons share one look. */}
        <div className="flex h-8 items-center rounded border border-border bg-[hsl(var(--panel-soft)/0.82)]">
          <button
            type="button"
            onClick={onOpenSettings}
            title={t("topBar.settings")}
            aria-label={t("topBar.settings")}
            className="flex h-full items-center rounded-l px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings size={14} />
          </button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <button
            type="button"
            onClick={onOpenShortcuts}
            title={t("topBar.shortcuts")}
            aria-label={t("topBar.shortcuts")}
            className="flex h-full items-center rounded-r px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Keyboard size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
