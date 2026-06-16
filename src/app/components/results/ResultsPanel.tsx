import { Columns3, Copy, Download, Loader2, Table2, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { DatabaseObjectDetails, QueryResult, QueryState, ResultPanelTab } from "../../types";
import { IconButton } from "../ui";
import { ColumnsView } from "./ColumnsView";
import { DataGrid } from "./DataGrid";

export function ResultsPanel({
  activeTab,
  details,
  onClose,
  onCopy,
  onExport,
  onTabChange,
  queryResult,
  queryState,
}: {
  activeTab: ResultPanelTab;
  details: DatabaseObjectDetails | null;
  onClose: () => void;
  onCopy: () => void;
  onExport: () => void;
  onTabChange: (tab: ResultPanelTab) => void;
  queryResult: QueryResult | null;
  queryState: QueryState;
}) {
  const tabs = [
    { id: "results" as const, icon: Table2, label: "Results" },
    { id: "columns" as const, icon: Columns3, label: "Columns" },
  ];

  return (
    <section className="chrome-panel flex h-[280px] shrink-0 flex-col border-t border-border">
      <div className="flex h-9 items-center justify-between border-b border-border">
        <div className="flex h-full items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex h-full items-center gap-1.5 border-r border-border px-3 text-[12px]",
                  activeTab === tab.id
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={14} className={cn(activeTab === tab.id && "text-primary")} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 pr-2">
          <IconButton title="Copy" onClick={onCopy}>
            <Copy size={14} />
          </IconButton>
          <IconButton title="Export CSV" onClick={onExport}>
            <Download size={14} />
          </IconButton>
          <IconButton title="Close results" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {queryState === "running" ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-primary" />
            Running query
          </div>
        ) : activeTab === "columns" ? (
          <ColumnsView details={details} />
        ) : (
          <DataGrid queryResult={queryResult} />
        )}
      </div>
    </section>
  );
}
