import { useExplorer } from "../../workspace/workspaceCore";
import { ExplorerNode } from "./ExplorerNode";

export function ExplorerTree() {
  const { explorerTree } = useExplorer();

  return (
    <div className="min-h-0 flex-1 overflow-auto px-1.5 py-2">
      {explorerTree.map((node) => (
        <ExplorerNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
