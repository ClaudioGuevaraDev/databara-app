import { Search, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { useExplorer } from "../../workspace/workspaceCore";

export function ExplorerFilter() {
  const { t } = useI18n();
  const { explorerFilter, setExplorerFilter } = useExplorer();

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border px-1.5">
      <div className="relative flex w-full items-center">
        <Search
          size={13}
          className="pointer-events-none absolute left-2 shrink-0 text-muted-foreground"
        />
        <input
          type="text"
          value={explorerFilter}
          onChange={(event) => setExplorerFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setExplorerFilter("");
          }}
          placeholder={t("explorer.filterPlaceholder")}
          className="h-7 w-full rounded border border-border bg-[hsl(var(--panel-soft))] pl-7 pr-7 text-[12px] text-foreground outline-none focus:border-primary"
        />
        {explorerFilter ? (
          <button
            type="button"
            onClick={() => setExplorerFilter("")}
            title={t("explorer.clearFilter")}
            aria-label={t("explorer.clearFilter")}
            className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
