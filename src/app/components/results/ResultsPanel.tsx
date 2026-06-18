import { Braces, Columns3, Loader2, Table2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { DatabaseObjectDetails, QueryResult, QueryState, ResultPanelTab } from "../../types";
import { ColumnsView } from "./ColumnsView";
import { DataGrid } from "./DataGrid";
import { SchemaView } from "./SchemaView";

export function ResultsPanel({
  activeTab,
  details,
  onTabChange,
  queryResult,
  queryState,
}: {
  activeTab: ResultPanelTab;
  details: DatabaseObjectDetails | null;
  onTabChange: (tab: ResultPanelTab) => void;
  queryResult: QueryResult | null;
  queryState: QueryState;
}) {
  const tabs = [
    { id: "results" as const, icon: Table2, label: "Results" },
    { id: "columns" as const, icon: Columns3, label: "Columns" },
    { id: "schema" as const, icon: Braces, label: "Schema" },
  ];
  return (
    <section className="chrome-panel flex h-[280px] shrink-0 flex-col border-t border-border">
      <div className="flex h-9 items-center border-b border-border">
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
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {queryState === "running" ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-primary" />
            Running query
          </div>
        ) : activeTab === "columns" ? (
          <ColumnsView details={details} />
        ) : activeTab === "schema" ? (
          <SchemaView details={details} />
        ) : (
          <DataGrid queryResult={queryResult} />
        )}
      </div>
    </section>
  );
}
