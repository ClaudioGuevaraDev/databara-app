import { useI18n } from "../../i18n/I18nContext";
import type { QueryResult } from "../../types";
import { EmptyPanel } from "../ui";

export function DataGrid({ queryResult }: { queryResult: QueryResult | null }) {
  const { t } = useI18n();
  if (!queryResult) return <EmptyPanel text={t("results.emptyGrid")} />;

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
                key={`${cell ?? "NULL"}-${cellIndex}`}
                className="max-w-64 truncate border-b border-r border-border px-2 py-1.5 text-foreground"
              >
                {cell ?? "NULL"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
