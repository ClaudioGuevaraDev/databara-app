import { FileText, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import {
  applyConfigurationImport,
  parseConfigurationImport,
  pickOpenPath,
  readTextFile,
  summarizeConfigurationImport,
  type ConfigurationExport,
  type ConfigurationImportSummary,
} from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import { readErrorMessage } from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  FormAlert,
} from "../ui";

type Phase = "idle" | "loading" | "loaded" | "applying" | "error";

// Restores app state from a previously exported Databara configuration file.
// Opened from several entry points (top bar, explorer, empty workspace, status
// bar). The flow is: pick file → show a summary → confirm → apply + reload.
export function LoadConfigDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const isDesktop = "__TAURI_INTERNALS__" in window;
  const [phase, setPhase] = useState<Phase>("idle");
  const [config, setConfig] = useState<ConfigurationExport | null>(null);
  const [summary, setSummary] = useState<ConfigurationImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "loading" || phase === "applying";

  async function chooseFile() {
    setError(null);
    setPhase("loading");
    try {
      const path = await pickOpenPath();
      if (!path) {
        setPhase(config ? "loaded" : "idle");
        return;
      }
      const parsed = parseConfigurationImport(await readTextFile(path));
      setConfig(parsed);
      setSummary(summarizeConfigurationImport(parsed));
      setPhase("loaded");
    } catch (loadError) {
      setConfig(null);
      setSummary(null);
      setError(readErrorMessage(loadError));
      setPhase("error");
    }
  }

  async function apply() {
    if (!config) return;
    setError(null);
    setPhase("applying");
    try {
      await applyConfigurationImport(config);
      window.location.reload();
    } catch (applyError) {
      setError(readErrorMessage(applyError));
      setPhase("error");
    }
  }

  const exportedDate = summary ? new Date(summary.exportedAt) : null;
  const exportedLabel =
    exportedDate && !Number.isNaN(exportedDate.getTime())
      ? exportedDate.toLocaleString()
      : summary?.exportedAt;

  return (
    <DialogFrame maxWidth="max-w-[440px]">
      <DialogHeader
        title={
          <>
            <Upload size={16} className="shrink-0 text-primary" />
            <span className="truncate">{t("dialogs.loadConfig.title")}</span>
          </>
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px]">
        <p className="text-muted-foreground">{t("dialogs.loadConfig.intro")}</p>

        {!isDesktop ? (
          <FormAlert tone="error">{t("dialogs.loadConfig.unavailable")}</FormAlert>
        ) : (
          <button
            type="button"
            onClick={() => void chooseFile()}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 justify-self-start rounded border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
          >
            {phase === "loading" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            {phase === "loading"
              ? t("dialogs.loadConfig.choosingFile")
              : t("dialogs.loadConfig.chooseFile")}
          </button>
        )}

        {summary ? (
          <div className="grid gap-2 rounded-md border border-border p-3">
            <div className="text-[13px] font-semibold text-foreground">
              {t("dialogs.loadConfig.summaryTitle")}
            </div>
            <ul className="grid gap-1 text-muted-foreground">
              <li>{t("dialogs.loadConfig.connectionCount", { count: summary.connectionCount })}</li>
              <li>
                {summary.includesPasswords
                  ? t("dialogs.loadConfig.includesPasswords")
                  : t("dialogs.loadConfig.excludesPasswords")}
              </li>
              {exportedLabel ? (
                <li>{t("dialogs.loadConfig.exportedAt", { date: exportedLabel })}</li>
              ) : null}
            </ul>
            <FormAlert tone="error">{t("dialogs.loadConfig.replaceWarning")}</FormAlert>
          </div>
        ) : null}

        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      </DialogBody>
      <DialogActions>
        <button type="button" onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={!config || busy}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {phase === "applying" ? <Loader2 size={14} className="animate-spin" /> : null}
          {phase === "applying" ? t("dialogs.loadConfig.applying") : t("dialogs.loadConfig.apply")}
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
