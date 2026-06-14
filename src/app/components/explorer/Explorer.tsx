import {
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  Folder,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../../lib/utils";
import type { DatabaseObjectKind, DatabaseTreeNode } from "../../types";
import { savedConnectionNodeId, useExplorer } from "../../workspaceCore";
import { IconButton, MetricMini } from "../ui";
import { connectionKey, findStoredConnectionForNode, getExplorerStats } from "./treeUtils";

export function Explorer() {
  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-r border-border">
      <ExplorerHeader />
      <ExplorerStats />
      <ExplorerTree />
    </aside>
  );
}

function ExplorerHeader() {
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

function ExplorerStats() {
  const { activeConnection, explorerTree } = useExplorer();
  const stats = useMemo(() => getExplorerStats(explorerTree), [explorerTree]);

  return (
    <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
      <MetricMini value={String(stats.tables)} label="tables" />
      <MetricMini value={String(stats.schemas)} label="schemas" />
      <MetricMini
        value={activeConnection ? `${activeConnection.latencyMs}ms` : "--"}
        label="ping"
        amber
      />
    </div>
  );
}

function ExplorerTree() {
  const { explorerTree } = useExplorer();

  return (
    <div className="min-h-0 flex-1 overflow-auto px-1.5 py-2">
      {explorerTree.map((node) => (
        <ExplorerNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function ExplorerNode({ depth, node }: { depth: number; node: DatabaseTreeNode }) {
  const explorer = useExplorer();
  const hasChildren = Boolean(node.children?.length);
  const selectable = node.kind === "table" || node.kind === "view";
  const savedConnection = node.id.startsWith("saved-connection:");
  const deletableConnection = findStoredConnectionForNode(
    node,
    explorer.explorerTree,
    explorer.storedConnections,
  );
  const connectedDatabase = deletableConnection
    ? explorer.connectedConnectionKeys.has(connectionKey(deletableConnection))
    : false;
  const selected = node.id === explorer.selectedObjectId;
  const collapsed = node.open === false || explorer.collapsedNodes.has(node.id);

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) explorer.toggleNode(node.id);
          if (selectable) explorer.selectObject(node.id);
          if (savedConnection) explorer.openSavedConnection(node.id);
        }}
        onDoubleClick={() => {
          if (selectable) explorer.confirmObjectTab(node.id);
        }}
        className={cn(
          "group flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          selected &&
            "border border-primary/25 bg-[hsl(var(--primary)/0.12)] text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]",
        )}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
      >
        {hasChildren ? (
          collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <TreeIcon
          kind={node.kind}
          className={cn(selected ? "text-primary" : "text-muted-foreground")}
        />
        <span className="truncate">{node.label}</span>
        {node.id.startsWith("connection:") ? (
          <Circle size={7} className="ml-auto fill-emerald-400 text-emerald-400" />
        ) : deletableConnection ? (
          <span className="ml-auto flex items-center gap-1">
            <span
              title={connectedDatabase ? "Connected" : "Saved connection"}
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                connectedDatabase
                  ? "border-emerald-300/80 bg-emerald-400 shadow-[0_0_10px_hsl(142_76%_55%/0.45)]"
                  : "border-amber-300/70 bg-amber-300/75 shadow-[0_0_6px_hsl(43_96%_56%/0.16)]",
              )}
            />
            <span
              role="button"
              tabIndex={0}
              title="Delete connection"
              onClick={(event) => {
                event.stopPropagation();
                explorer.deleteConnection(
                  savedConnection ? node.id : savedConnectionNodeId(deletableConnection),
                );
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                explorer.deleteConnection(
                  savedConnection ? node.id : savedConnectionNodeId(deletableConnection),
                );
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus:bg-muted focus:text-destructive"
            >
              <Trash2 size={12} />
            </span>
          </span>
        ) : null}
      </button>
      {!collapsed && hasChildren ? (
        <div>
          {node.children?.map((child) => (
            <ExplorerNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreeIcon({ kind, className }: { className: string; kind: DatabaseObjectKind }) {
  if (kind === "schema") return <Folder size={14} className={className} />;
  if (kind === "view") return <Braces size={14} className={className} />;
  if (kind === "table") return <Table2 size={14} className={className} />;
  return <Database size={14} className={className} />;
}
