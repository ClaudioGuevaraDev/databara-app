import { useMemo } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { useExplorer } from "../../workspace/workspaceCore";
import { ExplorerNode } from "./ExplorerNode";
import { filterExplorerTree } from "./treeUtils";

export function ExplorerTree() {
  const { t } = useI18n();
  const { explorerTree, explorerFilter } = useExplorer();
  const nodes = useMemo(
    () => filterExplorerTree(explorerTree, explorerFilter),
    [explorerTree, explorerFilter],
  );

  return (
    <div className="scroll-overlay min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2">
      {nodes.map((node) => (
        <ExplorerNode key={node.id} node={node} depth={0} />
      ))}
      {explorerFilter.trim() && nodes.length === 0 ? (
        <div className="px-2 py-3 text-[12px] text-muted-foreground">{t("explorer.noMatches")}</div>
      ) : null}
    </div>
  );
}
