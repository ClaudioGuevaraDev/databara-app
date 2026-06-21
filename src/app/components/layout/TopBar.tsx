import { Database, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getAppVersion } from "../../databaraService";

export function TopBar({
  onNewConnection,
  onCheckForUpdates,
}: {
  onNewConnection: () => void;
  onCheckForUpdates: () => void;
}) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    void getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

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
          <div className="text-[13px] text-foreground">
            Database workspace{version ? ` · v${version}` : ""} · test
          </div>
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
          onClick={onCheckForUpdates}
          title="Check for updates"
          className="control flex h-8 items-center gap-1.5 rounded px-3 text-[12px]"
        >
          <RefreshCw size={14} />
          Update
        </button>
      </div>
    </header>
  );
}
