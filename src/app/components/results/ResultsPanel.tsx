import { Braces, Columns3, Loader2, Table2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { BOTTOM_PANEL_HEIGHT_MAX, BOTTOM_PANEL_HEIGHT_MIN } from "../../databaraService";
import { useI18n } from "../../i18n/I18nContext";
import type {
  DatabaseObjectDetails,
  QueryPagination,
  QueryResult,
  QueryState,
  ResultPanelTab,
} from "../../types";
import { useSettings } from "../../workspace/workspaceCore";
import { EmptyPanel, ResizeHandle } from "../ui";
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
  const { t } = useI18n();
  const { settings, setBottomPanelHeight } = useSettings();
  // Live height while dragging; persisted only on release (see WorkspaceShell).
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const height = dragHeight ?? settings.bottomPanelHeight.height;

  const tabs = [
    { id: "results" as const, icon: Table2, label: t("results.tabs.results") },
    { id: "columns" as const, icon: Columns3, label: t("results.tabs.columns") },
    { id: "schema" as const, icon: Braces, label: t("results.tabs.schema") },
  ];

  const showStatusLine =
    activeTab === "results" && (queryState === "success" || queryState === "error");
  const statusMessage =
    queryState === "error"
      ? (queryError ?? t("results.queryFailed"))
      : (queryResult?.message ?? t("results.done"));

  return (
    <section
      className="chrome-panel relative flex shrink-0 flex-col border-t border-border"
      style={{ height }}
    >
      <ResizeHandle
        axis="y"
        inverted
        ariaLabel={t("results.resize")}
        value={height}
        min={BOTTOM_PANEL_HEIGHT_MIN}
        max={BOTTOM_PANEL_HEIGHT_MAX}
        onResize={setDragHeight}
        onCommit={(next) => {
          setBottomPanelHeight(next);
          setDragHeight(null);
        }}
        className="absolute inset-x-0 top-0 -translate-y-1/2"
      />
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
            {t("results.running")}
          </div>
        ) : activeTab === "columns" ? (
          <ColumnsView details={details} />
        ) : activeTab === "schema" ? (
          <SchemaView details={details} />
        ) : queryState === "error" ? (
          <pre className="h-full w-full overflow-auto whitespace-pre-wrap p-3 font-mono text-[12px] text-destructive">
            {queryError ?? t("results.queryFailed")}
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
