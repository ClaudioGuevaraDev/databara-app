import { FileJson, Table2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../i18n/I18nContext";
import type { DatabaseObjectDetails, ResultPanelTab, ResultViewMode } from "../../types";

// The bar sitting between the tabs and the content. For the Results tab it holds the
// Table/JSON view switch; for Columns/Schema it shows a context label.
export function ResultsViewBar({
  activeTab,
  details,
  onViewModeChange,
  viewMode,
}: {
  activeTab: ResultPanelTab;
  details: DatabaseObjectDetails | null;
  onViewModeChange: (mode: ResultViewMode) => void;
  viewMode: ResultViewMode;
}) {
  const { t } = useI18n();
  const isResults = activeTab === "results";

  const viewModes = [
    { id: "table" as const, icon: Table2, label: t("results.viewTable") },
    { id: "json" as const, icon: FileJson, label: t("results.viewJson") },
  ];

  return (
    <div className="flex h-9 items-center border-b border-border bg-[hsl(var(--panel-soft)/0.45)] px-2 [background-image:linear-gradient(90deg,hsl(var(--primary)/0.05),transparent_40%)]">
      <div className="flex items-center">
        {isResults ? (
          <div
            role="tablist"
            aria-label={t("results.viewMode")}
            className="relative inline-flex items-center rounded-[9px] border border-border bg-[hsl(var(--background)/0.6)] p-0.5"
          >
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[7px] border border-primary/45 bg-gradient-to-b from-primary/20 to-primary/[0.12] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_1px_6px_hsl(var(--primary)/0.18)] transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ transform: viewMode === "json" ? "translateX(100%)" : "translateX(0)" }}
            />
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              const selected = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onViewModeChange(mode.id)}
                  className={cn(
                    "relative z-10 flex h-6 min-w-[64px] items-center justify-center gap-1.5 px-3 text-[12px] transition-colors",
                    selected
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={13} className={cn(selected && "text-primary")} />
                  {mode.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-[11.5px] tracking-[0.02em] text-muted-foreground">
            {activeTab === "columns" ? (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  {details?.columns.length ?? 0}
                </span>{" "}
                {t("results.columnsCount")}
              </>
            ) : (
              <>
                {details ? `${details.schema}.` : ""}
                <span className="font-semibold text-foreground">{details?.name}</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
