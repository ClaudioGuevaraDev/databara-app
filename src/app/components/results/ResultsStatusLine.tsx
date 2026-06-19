import { cn } from "../../../lib/utils";
import type { QueryState } from "../../types";

export function ResultsStatusLine({
  queryState,
  message,
}: {
  queryState: QueryState;
  message: string;
}) {
  const isError = queryState === "error";

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isError ? "bg-destructive" : "bg-emerald-400",
        )}
      />
      <span className="truncate">{message}</span>
    </div>
  );
}
