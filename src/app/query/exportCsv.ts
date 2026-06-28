import type { QueryResult } from "../types";

export function exportQueryResultCsv(result: QueryResult): string {
  const escapeCell = (cell: string | null) => `"${(cell ?? "NULL").replace(/"/g, '""')}"`;
  return [
    result.columns.map(escapeCell).join(","),
    ...result.rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");
}
