import {
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  Download,
  Link,
  Pencil,
  RefreshCw,
  ServerOff,
  Unlink,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../i18n/I18nContext";
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
  const { t } = useI18n();
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
  // Node ids (e.g. `table:public.analytics`, `schema:public`) repeat across
  // connections, so scope selection and expand/collapse by the owning
  // connection to avoid two same-named objects acting as one.
  const selected =
    node.id === explorer.selectedObjectId && nodeConnectionKey === explorer.selectedConnectionKey;
  const rowRef = useRef<HTMLButtonElement>(null);
  // Cuando esta fila es la seleccionada (p. ej. al cargar/reconectar y expandir
  // hasta la tabla activa), centrarla en el sidebar para que sea fácil de ubicar.
  useEffect(() => {
    if (!selected) return;
    // rAF: esperar a que los nodos hermanos terminen de montar/expandir para
    // que el cálculo de scroll use el layout final del árbol.
    const raf = requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selected]);
  // Servers start expanded; databases and everything below start collapsed.
  // A database is expanded explicitly (its key seeded into `toggledNodes`) when
  // it has open tabs or when the user connects it from a dialog. `toggledNodes`
  // records flips from that default, so manual toggling works both ways.
  const defaultExpanded = node.id.startsWith("server:");
  const nodeKey = `${nodeConnectionKey ?? ""}::${node.id}`;
  const userToggled = explorer.toggledNodes.has(nodeKey);
  const collapsed = defaultExpanded ? userToggled : !userToggled;

  return (
    <div>
      <button
        ref={rowRef}
        onClick={() => {
          if (hasChildren) explorer.toggleNode(nodeKey);
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
          isServer={node.id.startsWith("server:")}
        />
        <span className="truncate">{node.label}</span>
        {node.id.startsWith("connection:") ? (
          <Circle size={7} className="ml-auto shrink-0 fill-emerald-400 text-emerald-400" />
        ) : node.id.startsWith("server:") ? (
          <span className="ml-auto flex shrink-0 items-center gap-0">
            <span
              role="button"
              tabIndex={0}
              title={t("explorer.addDatabase")}
              onClick={(event) => {
                event.stopPropagation();
                void explorer.openAddDatabase(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                void explorer.openAddDatabase(node.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
            >
              <span className="relative flex items-center justify-center">
                <Database size={12} />
                <Link
                  size={8}
                  strokeWidth={3}
                  className="absolute -bottom-1 -right-1 rounded-full bg-[hsl(var(--background))]"
                />
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              title={t("explorer.renameServer")}
              onClick={(event) => {
                event.stopPropagation();
                explorer.openRenameServer(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                explorer.openRenameServer(node.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
            >
              <Pencil size={12} />
            </span>
            <span
              role="button"
              tabIndex={0}
              title={t("explorer.disconnectServer")}
              onClick={(event) => {
                event.stopPropagation();
                explorer.openDeleteServer(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                explorer.openDeleteServer(node.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-amber-400 focus:bg-muted focus:text-amber-400"
            >
              <ServerOff size={12} />
            </span>
          </span>
        ) : deletableConnection ? (
          <span className="ml-auto flex shrink-0 items-center gap-0">
            <span className="flex h-5 w-5 items-center justify-center">
              <span
                title={connectedDatabase ? t("explorer.connected") : t("explorer.savedConnection")}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border",
                  connectedDatabase
                    ? "border-emerald-300/80 bg-emerald-400 shadow-[0_0_10px_hsl(142_76%_55%/0.45)]"
                    : "border-amber-300/70 bg-amber-300/75 shadow-[0_0_6px_hsl(43_96%_56%/0.16)]",
                )}
              />
            </span>
            {connectedDatabase ? (
              <span
                role="button"
                tabIndex={0}
                title={t("explorer.refreshTables")}
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
            {connectedDatabase ? (
              <span
                role="button"
                tabIndex={0}
                title={t("explorer.downloadBackup")}
                onClick={(event) => {
                  event.stopPropagation();
                  explorer.openDownloadBackup(nodeConnectionKey);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  explorer.openDownloadBackup(nodeConnectionKey);
                }}
                className="mr-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <span className="relative flex items-center justify-center">
                  <Database size={12} />
                  <Download
                    size={8}
                    strokeWidth={3}
                    className="absolute -bottom-1 -right-2 rounded-full bg-[hsl(var(--background))]"
                  />
                </span>
              </span>
            ) : null}
            <span
              role="button"
              tabIndex={0}
              title={t("explorer.disconnectDatabase")}
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
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-amber-400 focus:bg-muted focus:text-amber-400"
            >
              <Unlink size={12} />
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
