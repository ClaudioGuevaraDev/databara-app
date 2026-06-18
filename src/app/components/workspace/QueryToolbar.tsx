import { Play, Save } from "lucide-react";
import { cn } from "../../../lib/utils";

export function QueryToolbar({
  canSave,
  onRun,
  onSave,
}: {
  canSave: boolean;
  onRun: () => void;
  onSave: () => void;
}) {
  return (
    <div className="chrome-panel hairline flex h-10 shrink-0 items-center border-b border-border px-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onRun}
          className="flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.14)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Play size={14} />
          Run
        </button>
        <button
          onClick={onSave}
          disabled={!canSave}
          title="Save SQL tab"
          className={cn(
            "ml-1 flex h-7 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
            canSave
              ? "bg-emerald-500/14 hover:bg-emerald-500/22 text-emerald-200 shadow-[inset_0_0_0_1px_hsl(160_84%_39%/.36)]"
              : "bg-muted/60 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]",
          )}
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  );
}
