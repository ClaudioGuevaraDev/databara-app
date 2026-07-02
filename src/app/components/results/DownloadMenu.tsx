import { Download } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../i18n/I18nContext";
import type { ResultExportFormat, ResultExportScope } from "../../types";

// "Download" button with a small popover to pick the export format (CSV/JSON)
// and scope (current page / all pages) before the native save dialog opens.
// The format defaults to whatever the results view shows (Table → CSV, JSON → JSON).
export function DownloadMenu({
  defaultFormat,
  onDownload,
}: {
  defaultFormat: ResultExportFormat;
  onDownload: (format: ResultExportFormat, scope: ResultExportScope) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ResultExportFormat>(defaultFormat);
  const [scope, setScope] = useState<ResultExportScope>("page");
  const containerRef = useRef<HTMLDivElement>(null);

  // Each time the menu opens, preselect the format matching the current view.
  const toggleOpen = () =>
    setOpen((value) => {
      if (!value) setFormat(defaultFormat);
      return !value;
    });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const formats: { id: ResultExportFormat; label: string }[] = [
    { id: "csv", label: "CSV" },
    { id: "json", label: "JSON" },
  ];
  const scopes: { id: ResultExportScope; label: string }[] = [
    { id: "page", label: t("results.downloadCurrentPage") },
    { id: "all", label: t("results.downloadAllPages") },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded border border-border bg-[hsl(var(--background)/0.6)] px-2.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground",
        )}
      >
        <Download size={13} />
        {t("results.download")}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-lg border border-border bg-[hsl(var(--panel-soft))] p-3 shadow-[0_12px_28px_hsl(var(--shadow-strong)/0.4)]">
          <Group label={t("results.downloadFormat")}>
            {formats.map((option) => (
              <Choice
                key={option.id}
                label={option.label}
                selected={format === option.id}
                onClick={() => setFormat(option.id)}
              />
            ))}
          </Group>
          <Group label={t("results.downloadScope")}>
            {scopes.map((option) => (
              <Choice
                key={option.id}
                label={option.label}
                selected={scope === option.id}
                onClick={() => setScope(option.id)}
              />
            ))}
          </Group>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDownload(format, scope);
            }}
            className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded border border-primary/45 bg-gradient-to-b from-primary/20 to-primary/[0.12] px-3 text-[12px] font-medium text-foreground transition-colors hover:from-primary/25 hover:to-primary/15"
          >
            <Download size={13} className="text-primary" />
            {t("results.downloadConfirm")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-7 min-w-0 flex-1 items-center justify-center rounded border px-2 text-[12px] transition-colors",
        selected
          ? "border-primary/45 bg-[hsl(var(--primary)/0.16)] font-medium text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
