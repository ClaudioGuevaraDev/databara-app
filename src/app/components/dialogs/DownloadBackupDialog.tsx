import { Download, FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listenBackupProgress } from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import type { BackupRequest } from "../../workspace/workspaceCore";
import { readErrorMessage } from "./connectionForm";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Field,
  FormAlert,
} from "../ui";

type Phase = "idle" | "running" | "done" | "error";

export function DownloadBackupDialog({
  request,
  onClose,
  onChooseDirectory,
  onDownload,
}: {
  request: BackupRequest;
  onClose: () => void;
  onChooseDirectory: () => Promise<string | null>;
  onDownload: (directory: string, fileName: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [fileName, setFileName] = useState(request.defaultFileName);
  const [directory, setDirectory] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [currentTable, setCurrentTable] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Live progress is pushed from Rust as the dump is written; subscribe while open.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listenBackupProgress((progress) => {
      setPercent(progress.percent);
      setCurrentTable(progress.table);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const running = phase === "running";

  async function browse() {
    const chosen = await onChooseDirectory();
    if (chosen) setDirectory(chosen);
  }

  async function download() {
    if (!directory || !fileName.trim()) return;
    setPhase("running");
    setError(null);
    setPercent(0);
    setCurrentTable("");
    try {
      await onDownload(directory, fileName.trim());
      setPhase("done");
    } catch (downloadError) {
      setError(readErrorMessage(downloadError));
      setPhase("error");
    }
  }

  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            <Download size={16} className="shrink-0 text-primary" />
            <span className="truncate">{t("dialogs.backup.title")}</span>
          </>
        }
      >
        {running ? null : <DialogCloseButton onClick={onClose} />}
      </DialogHeader>
      <DialogBody className="grid gap-3">
        <div className="text-[12px] text-muted-foreground">
          {t("dialogs.backup.hint")}{" "}
          <span className="font-semibold text-foreground">{request.databaseName}</span>
        </div>
        <Field
          autoFocus
          label={t("dialogs.backup.fileNameLabel")}
          value={fileName}
          onChange={setFileName}
          placeholder={request.defaultFileName}
        />
        <div className="grid gap-1.5 text-[12px] text-muted-foreground">
          {t("dialogs.backup.locationLabel")}
          <div className="flex items-center gap-2">
            <div className="h-8 flex-1 truncate rounded border border-border bg-[hsl(var(--panel-soft))] px-2 font-mono text-[11px] leading-8 text-foreground">
              {directory ?? t("dialogs.backup.chooseFolderHint")}
            </div>
            <button
              type="button"
              onClick={() => void browse()}
              disabled={running}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-border px-2.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-70"
            >
              <FolderOpen size={13} />
              {t("dialogs.backup.browse")}
            </button>
          </div>
        </div>
        {phase === "running" || phase === "done" ? (
          <div className="grid gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {phase === "done"
                  ? t("dialogs.backup.done")
                  : currentTable
                    ? t("dialogs.backup.downloading", { table: currentTable })
                    : `${percent}%`}
              </span>
              <span>{percent}%</span>
            </div>
          </div>
        ) : null}
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      </DialogBody>
      <DialogActions>
        <button
          type="button"
          onClick={onClose}
          disabled={running}
          className="control h-8 rounded px-3 text-[12px] disabled:opacity-70"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={running || !directory || !fileName.trim()}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {t("dialogs.backup.download")}
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
