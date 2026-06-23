import { ChevronDown, ChevronRight, Circle, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { DatabaseTreeNode } from "../../types";
import { savedConnectionNodeId, useExplorer } from "../../workspace/workspaceCore";
import { connectionKey, findStoredConnectionForNode } from "./treeUtils";
import { TreeIcon } from "./TreeIcon";

export function ExplorerNode({
  depth,
  node,
  inheritedConnectionKey,
}: {
  depth: number;
  node: DatabaseTreeNode;
  inheritedConnectionKey?: string;
}) {
  const explorer = useExplorer();
  const hasChildren = Boolean(node.children?.length);
  const selectable = node.kind === "table" || node.kind === "view";
  const savedConnection = node.id.startsWith("saved-connection:");
  const deletableConnection = findStoredConnectionForNode(
    node,
    explorer.explorerTree,
    explorer.storedConnections,
  );
  // A database/saved-connection node defines the connection for its whole subtree;
  // everything below inherits it so object clicks know which connection they belong to.
  const nodeConnectionKey =
    (deletableConnection ? connectionKey(deletableConnection) : undefined) ??
    inheritedConnectionKey;
  const connectedDatabase = deletableConnection
    ? explorer.connectedConnectionKeys.has(connectionKey(deletableConnection))
    : false;
  const selected = node.id === explorer.selectedObjectId;
  // Connection groups start expanded; everything below them (schemas, etc.)
  // starts collapsed. `toggledNodes` records the nodes the user flipped from
  // that default, so toggling works both ways without re-seeding on refresh.
  const userToggled = explorer.toggledNodes.has(node.id);
  const collapsed = savedConnection ? userToggled : !userToggled;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) explorer.toggleNode(node.id);
          if (selectable) explorer.selectObject(node.id, nodeConnectionKey);
          // A live connection group toggles its tables; only an unconnected one
          // should (re)open the connect/password flow.
          if (savedConnection && !connectedDatabase) explorer.openSavedConnection(node.id);
        }}
        onDoubleClick={() => {
          if (selectable) explorer.confirmObjectTab(node.id, nodeConnectionKey);
        }}
        className={cn(
          "group flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          selected &&
            "border border-primary/25 bg-[hsl(var(--primary)/0.12)] text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]",
        )}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
      >
        {hasChildren || savedConnection ? (
          hasChildren && !collapsed ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <TreeIcon
          className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}
          kind={node.kind}
        />
        <span className="truncate">{node.label}</span>
        {node.id.startsWith("connection:") ? (
          <Circle size={7} className="ml-auto shrink-0 fill-emerald-400 text-emerald-400" />
        ) : deletableConnection ? (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span
              title={connectedDatabase ? "Connected" : "Saved connection"}
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                connectedDatabase
                  ? "border-emerald-300/80 bg-emerald-400 shadow-[0_0_10px_hsl(142_76%_55%/0.45)]"
                  : "border-amber-300/70 bg-amber-300/75 shadow-[0_0_6px_hsl(43_96%_56%/0.16)]",
              )}
            />
            {connectedDatabase ? (
              <span
                role="button"
                tabIndex={0}
                title="Refresh tables"
                onClick={(event) => {
                  event.stopPropagation();
                  void explorer.refreshConnection(nodeConnectionKey);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  void explorer.refreshConnection(nodeConnectionKey);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <RefreshCw size={12} />
              </span>
            ) : null}
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
            <ExplorerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              inheritedConnectionKey={nodeConnectionKey}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
