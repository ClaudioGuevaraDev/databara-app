import { Database, Plus, Settings } from "lucide-react";

export function TopBar({
  onNewConnection,
  onOpenSettings,
}: {
  onNewConnection: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="chrome-panel flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 text-primary">
          <Database size={16} />
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Databara
          </div>
          <div className="text-[13px] text-foreground">Database workspace</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewConnection}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={14} />
          Connection
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </header>
  );
}
