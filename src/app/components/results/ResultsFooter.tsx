import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { QUERY_PAGE_SIZES, type QueryPagination } from "../../types";
import { IconButton } from "../ui";

export function ResultsFooter({
  pagination,
  isRunning,
  onPageChange,
  onPageSizeChange,
}: {
  pagination: QueryPagination;
  isRunning: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useI18n();
  const { page, pageSize, totalRows, pageSizeLocked } = pagination;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const firstRow = totalRows === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min((page + 1) * pageSize, totalRows);
  // The locked size (from the user's LIMIT) may not be one of the preset options.
  const sizeOptions = (QUERY_PAGE_SIZES as readonly number[]).includes(pageSize)
    ? QUERY_PAGE_SIZES
    : [pageSize, ...QUERY_PAGE_SIZES];

  return (
    <div className="chrome-panel flex h-9 shrink-0 items-center justify-between border-t border-border px-3 text-[12px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {t("results.pageWord")} <span className="text-foreground">{page + 1}</span>{" "}
          {t("results.of")} {totalPages}
        </span>
        <span className="text-border">·</span>
        <span>
          {t("results.rowsWord")} {firstRow.toLocaleString()}–{lastRow.toLocaleString()}{" "}
          {t("results.of")} <span className="text-foreground">{totalRows.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          {t("results.rowsLabel")}
          <select
            value={pageSize}
            disabled={isRunning || pageSizeLocked}
            title={pageSizeLocked ? t("results.pageSizeLocked") : undefined}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-7 rounded border border-border bg-background px-1.5 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <IconButton
          title={t("results.previousPage")}
          disabled={isRunning || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton
          title={t("results.nextPage")}
          disabled={isRunning || page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}
