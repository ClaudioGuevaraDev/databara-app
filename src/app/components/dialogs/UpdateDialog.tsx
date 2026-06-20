import { AlertTriangle, Download } from "lucide-react";
import type { UpdateProgress } from "../../types";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

const PHASE_TITLE: Record<UpdateProgress["phase"], string> = {
  checking: "Checking for updates",
  downloading: "Downloading update",
  installing: "Installing update",
  done: "Restarting…",
  error: "Update failed",
};

export function UpdateDialog({
  progress,
  onDismiss,
}: {
  progress: UpdateProgress;
  onDismiss: () => void;
}) {
  const { phase, downloaded, total, version, notes, error } = progress;
  const isError = phase === "error";
  // The download/install/restart flow is automatic — no way to abort midway, so we
  // only offer a dismiss affordance once it has terminally failed.
  const dismissible = isError;
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
            <span className="truncate">{PHASE_TITLE[phase]}</span>
          </>
        }
      >
        {dismissible ? <DialogCloseButton onClick={onDismiss} /> : null}
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        {isError ? (
          <div className="text-destructive">{error ?? "The update could not be completed."}</div>
        ) : (
          <>
            {version ? (
              <div>
                New version available:{" "}
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
                      ? "Installing…"
                      : percent !== null
                        ? `${percent}%`
                        : "Downloading…"}
                  </span>
                  {total > 0 ? (
                    <span>
                      {formatBytes(downloaded)} / {formatBytes(total)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {phase === "done" ? <div>The app will restart to apply the update.</div> : null}
            {phase === "checking" ? <div>Checking for a new version…</div> : null}
          </>
        )}
      </DialogBody>
      {dismissible ? (
        <DialogActions>
          <button onClick={onDismiss} className="control h-8 rounded px-3 text-[12px]">
            Close
          </button>
        </DialogActions>
      ) : null}
    </DialogFrame>
  );
}
