import type { QueryResult } from "../types";
import { coerceCell } from "./coerceCell";

// Serializes a query result to the same typed JSON the JSON view renders: an
// array of row objects keyed by column name, with numbers/booleans/json/null
// unquoted via the column type categories.
export function exportQueryResultJson(result: QueryResult): string {
  const objects = result.rows.map((row) =>
    Object.fromEntries(
      result.columns.map((column, index) => [
        column,
        coerceCell(row[index], result.columnTypes[index] ?? "string"),
      ]),
    ),
  );
  return JSON.stringify(objects, null, 2);
}
