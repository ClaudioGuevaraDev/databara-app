import { ChevronRight, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getBrowserStorageEstimate,
  getStorageReport,
  pickSavePath,
  writeTextFile,
  type StorageReport,
} from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import type { TranslationKey } from "../../i18n/translate";
import { useSettings } from "../../workspace/workspaceCore";
import { cn, formatBytes } from "../../../lib/utils";
import { readErrorMessage } from "./connectionForm";
import { FormAlert, Switch } from "../ui";

type ExportPhase = "idle" | "exporting" | "error";

export function StorageSettingsTab() {
  const { t } = useI18n();
  const { settings, setExportIncludesPasswords, exportConfiguration, notify } = useSettings();
  const includePasswords = settings.exportIncludesPasswords.enabled;

  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  // Read once when the tab mounts (synchronous localStorage scan).
  const [report] = useState<StorageReport>(getStorageReport);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmingPasswords, setConfirmingPasswords] = useState(false);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBrowserStorageEstimate().then((value) => {
      if (!cancelled) setEstimate(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const usagePercent =
    estimate && estimate.quota > 0
      ? Math.min(100, Math.round((estimate.usage / estimate.quota) * 100))
      : 0;

  function onToggle(next: boolean) {
    setError(null);
    setPhase("idle");
    if (next && !includePasswords) {
      setConfirmingPasswords(true);
    } else {
      setExportIncludesPasswords(next);
    }
  }

  function confirmIncludePasswords() {
    setConfirmingPasswords(false);
    setExportIncludesPasswords(true);
  }

  async function runExport() {
    setError(null);
    setPhase("exporting");
    try {
      const path = await pickSavePath("databara-config.json", "json");
      if (!path) {
        setPhase("idle");
        return;
      }
      const data = await exportConfiguration(includePasswords);
      await writeTextFile(path, JSON.stringify(data, null, 2));
      setPhase("idle");
      notify(t("settings.storage.exported"), "success");
    } catch (exportError) {
      setError(readErrorMessage(exportError));
      setPhase("error");
    }
  }

  const exporting = phase === "exporting";

  return (
    <div className="grid gap-5 text-[12px]">
      {/* Usage */}
      <section className="grid gap-2">
        <div className="text-[13px] font-semibold text-foreground">
          {t("settings.storage.usageTitle")}
        </div>
        {estimate ? (
          <>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {t("settings.storage.usageLabel", {
                  used: formatBytes(estimate.usage),
                  total: formatBytes(estimate.quota),
                })}
              </span>
              <span className="tabular-nums">{usagePercent}%</span>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">{t("settings.storage.usageUnavailable")}</div>
        )}

        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
            className="flex w-full items-center justify-between rounded text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>
              {showDetails ? t("settings.storage.hideDetails") : t("settings.storage.viewDetails")}
            </span>
            <ChevronRight
              size={13}
              className={cn("transition-transform duration-200", showDetails && "rotate-90")}
            />
          </button>

          {/* Smooth height reveal via the grid-template-rows 0fr→1fr technique. */}
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              showDetails ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                {report.categories.length > 0 ? (
                  report.categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between border-b border-border px-3 py-1.5 last:border-b-0"
                    >
                      <span className="text-foreground">
                        {t(`settings.storage.categories.${category.id}` as TranslationKey)}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatBytes(category.bytes)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-1.5 text-muted-foreground">
                    {t("settings.storage.empty")}
                  </div>
                )}
                <div className="flex items-center justify-between bg-[hsl(var(--panel-soft))] px-3 py-1.5">
                  <span className="font-semibold text-foreground">
                    {t("settings.storage.total")}
                  </span>
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                    {formatBytes(report.totalBytes)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Export */}
      <section className="grid gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <div className="text-foreground">{t("settings.storage.includePasswords.title")}</div>
            <div className="text-muted-foreground">
              {t("settings.storage.includePasswords.description")}
            </div>
          </div>
          <Switch
            checked={includePasswords}
            label={t("settings.storage.includePasswords.title")}
            onChange={onToggle}
          />
        </div>

        {confirmingPasswords ? (
          <FormAlert tone="error">
            <div className="grid gap-2">
              <span>{t("settings.storage.includePasswords.warning")}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmIncludePasswords}
                  className="h-7 rounded bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground hover:brightness-110"
                >
                  {t("settings.storage.includePasswords.confirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingPasswords(false)}
                  className="control h-7 rounded px-2.5 text-[11px]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </FormAlert>
        ) : includePasswords ? (
          <FormAlert tone="error">{t("settings.storage.includePasswords.enabledNote")}</FormAlert>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            {t("settings.storage.passwordsExcludedNote")}
          </div>
        )}

        <button
          type="button"
          onClick={() => void runExport()}
          disabled={exporting}
          className="flex h-8 items-center gap-1.5 justify-self-start rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {t("settings.storage.export")}
        </button>

        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      </section>
    </div>
  );
}
