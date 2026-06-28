import type { ColumnTypeCategory } from "../types";

// Converts a textual cell into its natural JSON value based on the column's type
// category, so JSON output shows numbers/booleans/json/null unquoted instead of
// stringifying everything. Shared by the JSON view and the JSON export.
export function coerceCell(value: string | null, category: ColumnTypeCategory): unknown {
  if (value === null) return null;
  switch (category) {
    case "number": {
      const parsed = Number(value);
      // Only numberize when it round-trips exactly — preserves big int8/numeric
      // precision and leaves NaN/Infinity/"1.50" as strings.
      return Number.isFinite(parsed) && String(parsed) === value ? parsed : value;
    }
    case "boolean":
      return value === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
