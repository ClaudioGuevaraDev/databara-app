import { ChevronLeft, ChevronRight } from "lucide-react";
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
          Page <span className="text-foreground">{page + 1}</span> of {totalPages}
        </span>
        <span className="text-border">·</span>
        <span>
          rows {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{" "}
          <span className="text-foreground">{totalRows.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          Rows
          <select
            value={pageSize}
            disabled={isRunning || pageSizeLocked}
            title={pageSizeLocked ? "Page size set by the query's LIMIT" : undefined}
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
          title="Previous page"
          disabled={isRunning || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton
          title="Next page"
          disabled={isRunning || page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}
