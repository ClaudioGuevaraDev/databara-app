import { Braces, Columns3, Loader2, Table2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type {
  DatabaseObjectDetails,
  QueryPagination,
  QueryResult,
  QueryState,
  ResultPanelTab,
} from "../../types";
import { EmptyPanel } from "../ui";
import { ColumnsView } from "./ColumnsView";
import { DataGrid } from "./DataGrid";
import { ResultsFooter } from "./ResultsFooter";
import { ResultsStatusLine } from "./ResultsStatusLine";
import { SchemaView } from "./SchemaView";

export function ResultsPanel({
  activeTab,
  details,
  onPageChange,
  onPageSizeChange,
  onTabChange,
  queryError,
  queryPagination,
  queryResult,
  queryState,
}: {
  activeTab: ResultPanelTab;
  details: DatabaseObjectDetails | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onTabChange: (tab: ResultPanelTab) => void;
  queryError: string | null;
  queryPagination: QueryPagination | null;
  queryResult: QueryResult | null;
  queryState: QueryState;
}) {
  const tabs = [
    { id: "results" as const, icon: Table2, label: "Results" },
    { id: "columns" as const, icon: Columns3, label: "Columns" },
    { id: "schema" as const, icon: Braces, label: "Schema" },
  ];

  const showStatusLine =
    activeTab === "results" && (queryState === "success" || queryState === "error");
  const statusMessage =
    queryState === "error" ? (queryError ?? "Query failed") : (queryResult?.message ?? "Done");

  return (
    <section className="chrome-panel flex h-[360px] shrink-0 flex-col border-t border-border">
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
      {showStatusLine ? (
        <ResultsStatusLine queryState={queryState} message={statusMessage} />
      ) : null}
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
        ) : queryState === "error" ? (
          <pre className="h-full w-full overflow-auto whitespace-pre-wrap p-3 font-mono text-[12px] text-destructive">
            {queryError ?? "Query failed"}
          </pre>
        ) : queryResult && queryResult.columns.length > 0 ? (
          <DataGrid queryResult={queryResult} />
        ) : queryResult ? (
          <EmptyPanel text={queryResult.message} />
        ) : (
          <DataGrid queryResult={null} />
        )}
      </div>
      {activeTab === "results" && queryPagination ? (
        <ResultsFooter
          pagination={queryPagination}
          isRunning={queryState === "running"}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </section>
  );
}
