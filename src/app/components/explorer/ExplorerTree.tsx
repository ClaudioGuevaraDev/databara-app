import { useExplorer } from "../../workspace/workspaceCore";
import { ExplorerNode } from "./ExplorerNode";

export function ExplorerTree() {
  const { explorerTree } = useExplorer();

  return (
    <div className="scroll-overlay min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2">
      {explorerTree.map((node) => (
        <ExplorerNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
