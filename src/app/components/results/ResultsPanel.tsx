import { Columns3, Copy, Download, Loader2, Table2, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { DatabaseObjectDetails, QueryResult, QueryState, ResultPanelTab } from "../../types";
import { formatColumn, useResults } from "../../workspaceCore";
import { EmptyPanel, IconButton } from "../ui";
import { DetailRow } from "../ui/DetailRow";

export function ResultsDock() {
  const results = useResults();

  if (!results.resultsOpen) return null;

  return (
    <ResultsPanel
      activeTab={results.resultTab}
      details={results.details}
      queryResult={results.queryResult}
      queryState={results.queryState}
      onClose={results.closeResults}
      onCopy={() => void results.copyResult()}
      onExport={results.exportCsv}
      onTabChange={results.selectResultTab}
    />
  );
}

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

function DataGrid({ queryResult }: { queryResult: QueryResult | null }) {
  if (!queryResult) return <EmptyPanel text="Run a query to inspect result rows." />;

  return (
    <table className="min-w-full border-separate border-spacing-0 text-[12px]">
      <thead className="sticky top-0 bg-[hsl(var(--panel))]">
        <tr>
          {queryResult.columns.map((column) => (
            <th
              key={column}
              className="border-b border-r border-border px-2 py-1.5 text-left font-semibold text-foreground"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {queryResult.rows.map((row, rowIndex) => (
          <tr
            key={`${queryResult.id}-${rowIndex}`}
            className="odd:bg-[hsl(var(--panel-soft)/0.28)]"
          >
            {row.map((cell, cellIndex) => (
              <td
                key={`${cell}-${cellIndex}`}
                className="max-w-64 truncate border-b border-r border-border px-2 py-1.5 text-[hsl(210_20%_88%)]"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ColumnsView({ details }: { details: DatabaseObjectDetails | null }) {
  if (!details) return <EmptyPanel text="Select an object to inspect columns." />;
  return (
    <div className="p-3">
      {details.columns.map((column) => (
        <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
      ))}
    </div>
  );
}
