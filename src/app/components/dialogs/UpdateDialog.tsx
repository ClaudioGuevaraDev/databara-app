import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import type { TranslationKey } from "../../i18n/translate";
import type { UpdateProgress } from "../../types";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function UpdateDialog({
  progress,
  onDismiss,
  onDownloadManually,
}: {
  progress: UpdateProgress;
  onDismiss: () => void;
  onDownloadManually: () => void;
}) {
  const { t } = useI18n();
  const { phase, downloaded, total, version, notes, error } = progress;
  const isError = phase === "error";
  const isUnavailable = phase === "unavailable";
  // Terminal states that send the user to a manual download: a failed update, or an
  // install type that can't self-update (Linux .deb/.rpm). Both get Close + Download.
  const needsManualDownload = isError || isUnavailable;
  // The download/install/restart flow is automatic — no way to abort midway, so we
  // only offer a dismiss affordance on the terminal (manual-download) states.
  const dismissible = needsManualDownload;
  const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            {isError ? (
              <AlertTriangle size={16} className="shrink-0 text-destructive" />
            ) : (
              <Download size={16} className="shrink-0 text-primary" />
            )}
            <span className="truncate">{t(`dialogs.update.phase.${phase}` as TranslationKey)}</span>
          </>
        }
      >
        {dismissible ? <DialogCloseButton onClick={onDismiss} /> : null}
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        {isError ? (
          <div className="grid gap-2">
            <div className="text-destructive">{error ?? t("dialogs.update.errorFallback")}</div>
            <div>{t("dialogs.update.errorHelp")}</div>
          </div>
        ) : isUnavailable ? (
          <div className="grid gap-2">
            {version ? (
              <div>
                {t("dialogs.update.newVersion")}{" "}
                <span className="font-semibold text-foreground">v{version}</span>
              </div>
            ) : null}
            <div>{t("dialogs.update.cannotSelfUpdate")}</div>
          </div>
        ) : (
          <>
            {version ? (
              <div>
                {t("dialogs.update.newVersion")}{" "}
                <span className="font-semibold text-foreground">v{version}</span>
              </div>
            ) : null}
            {notes ? (
              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-2 text-[11px]">
                {notes}
              </div>
            ) : null}
            {phase === "downloading" || phase === "installing" ? (
              <div className="grid gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-150"
                    style={{ width: percent !== null ? `${percent}%` : "100%" }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>
                    {phase === "installing"
                      ? t("dialogs.update.installing")
                      : percent !== null
                        ? `${percent}%`
                        : t("dialogs.update.downloading")}
                  </span>
                  {total > 0 ? (
                    <span>
                      {formatBytes(downloaded)} / {formatBytes(total)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {phase === "done" ? <div>{t("dialogs.update.willRestart")}</div> : null}
            {phase === "checking" ? <div>{t("dialogs.update.checking")}</div> : null}
          </>
        )}
      </DialogBody>
      {dismissible ? (
        <DialogActions>
          <button onClick={onDismiss} className="control h-8 rounded px-3 text-[12px]">
            {t("common.close")}
          </button>
          <button
            onClick={onDownloadManually}
            className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
          >
            <ExternalLink size={14} />
            {t("dialogs.update.downloadManually")}
          </button>
        </DialogActions>
      ) : null}
    </DialogFrame>
  );
}
