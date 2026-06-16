import { useMemo } from "react";
import { useExplorer } from "../../workspace/workspaceCore";
import { MetricMini } from "../ui";
import { getExplorerStats } from "./treeUtils";

export function ExplorerStats() {
  const { activeConnection, explorerTree } = useExplorer();
  const stats = useMemo(() => getExplorerStats(explorerTree), [explorerTree]);

  return (
    <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
      <MetricMini value={String(stats.tables)} label="tables" />
      <MetricMini value={String(stats.schemas)} label="schemas" />
      <MetricMini
        amber
        value={activeConnection ? `${activeConnection.latencyMs}ms` : "--"}
        label="ping"
      />
    </div>
  );
}
