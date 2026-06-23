import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLatestReleaseVersion } from "../../updaterService";

export function StatusBar({ onCheckForUpdates }: { onCheckForUpdates: () => void }) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    void fetchLatestReleaseVersion().then((latest) => setVersion(latest ?? ""));
  }, []);

  return (
    <footer className="chrome-panel flex h-6 shrink-0 items-center justify-end gap-1 border-t border-border px-3 text-[11px] text-muted-foreground">
      {version ? <span className="leading-none">v{version}</span> : null}
      <button
        type="button"
        onClick={onCheckForUpdates}
        title="Check for updates"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw size={12} />
      </button>
    </footer>
  );
}
