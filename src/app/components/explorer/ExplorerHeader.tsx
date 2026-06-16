import { Plus } from "lucide-react";
import { useExplorer } from "../../workspace/workspaceCore";
import { IconButton } from "../ui";

export function ExplorerHeader() {
  const { openNewConnectionDialog } = useExplorer();

  return (
    <div className="flex h-9 items-center justify-between border-b border-border px-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Explorer
      </div>
      <IconButton title="New connection" onClick={openNewConnectionDialog}>
        <Plus size={14} />
      </IconButton>
    </div>
  );
}
