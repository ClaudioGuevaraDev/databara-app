import { ExplorerHeader } from "./ExplorerHeader";
import { ExplorerStats } from "./ExplorerStats";
import { ExplorerTree } from "./ExplorerTree";

export function Explorer() {
  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-r border-border">
      <ExplorerHeader />
      <ExplorerStats />
      <ExplorerTree />
    </aside>
  );
}
