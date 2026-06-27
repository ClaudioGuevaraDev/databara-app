import { useI18n } from "../../i18n/I18nContext";
import type { QueryResult } from "../../types";
import { EmptyPanel } from "../ui";

export function JsonView({ queryResult }: { queryResult: QueryResult | null }) {
  const { t } = useI18n();
  if (!queryResult || queryResult.columns.length === 0)
    return <EmptyPanel text={t("results.emptyGrid")} />;

  const objects = queryResult.rows.map((row) =>
    Object.fromEntries(queryResult.columns.map((column, index) => [column, row[index]])),
  );
  const json = JSON.stringify(objects, null, 2);

  return (
    <pre className="h-full w-full overflow-auto whitespace-pre p-3 font-mono text-[12px] text-[hsl(210_20%_88%)]">
      {json}
    </pre>
  );
}
