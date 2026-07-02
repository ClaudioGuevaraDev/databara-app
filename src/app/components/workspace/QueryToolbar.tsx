import { Loader2, Play, Save } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../i18n/I18nContext";

export function QueryToolbar({
  canSave,
  isRunning,
  onRun,
  onSave,
}: {
  canSave: boolean;
  isRunning: boolean;
  onRun: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="chrome-panel hairline flex h-10 shrink-0 items-center border-b border-border px-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.14)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {isRunning ? t("workspace.running") : t("workspace.run")}
        </button>
        <button
          onClick={onSave}
          disabled={!canSave}
          title={t("workspace.saveTab")}
          className={cn(
            "ml-1 flex h-7 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
            canSave
              ? "dark:bg-emerald-500/14 dark:hover:bg-emerald-500/22 bg-emerald-500/15 text-emerald-700 shadow-[inset_0_0_0_1px_hsl(160_84%_39%/.5)] hover:bg-emerald-500/25 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_hsl(160_84%_39%/.36)]"
              : "bg-muted/60 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]",
          )}
        >
          <Save size={14} />
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
