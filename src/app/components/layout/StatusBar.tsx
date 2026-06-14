import { Circle } from "lucide-react";
import type { ConnectionProfile } from "../../types";

export function StatusBar({ activeConnection }: { activeConnection: ConnectionProfile | null }) {
  return (
    <footer className="chrome-panel flex h-7 shrink-0 items-center border-t border-border px-3 text-[12px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Circle size={7} className="fill-emerald-400 text-emerald-400" />
          {activeConnection
            ? `${activeConnection.engine} ${activeConnection.engineVersion}`
            : "PostgreSQL"}
        </span>
        <span>{activeConnection?.database ?? "No database connected"}</span>
        <span>{activeConnection?.defaultSchema ?? "--"}</span>
      </div>
    </footer>
  );
}
