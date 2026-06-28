import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { ColumnTypeCategory, QueryResult } from "../../types";
import { EmptyPanel } from "../ui";

type JsonTone = "key" | "string" | "number" | "boolean" | "null" | "punct";

// Matches one JSON token at a time: strings, numbers, the literals, or structural
// punctuation. Whitespace/indentation falls in the gaps between matches.
const TOKEN_RE =
  /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}[\],:]/g;

function classify(token: string, source: string, end: number): JsonTone {
  if (token[0] === '"') {
    // A string acts as a key only when the next non-space character is a colon.
    let i = end;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    return source[i] === ":" ? "key" : "string";
  }
  if (token === "true" || token === "false") return "boolean";
  if (token === "null") return "null";
  if (/^[{}[\],:]$/.test(token)) return "punct";
  return "number";
}

function toneClass(tone: JsonTone): string {
  switch (tone) {
    case "key":
      return "text-[hsl(188_72%_72%)]";
    case "string":
      return "text-[hsl(150_52%_66%)]";
    case "number":
      return "text-[hsl(22_95%_72%)]";
    case "boolean":
      return "font-semibold text-[hsl(280_62%_75%)]";
    case "null":
      return "italic text-[hsl(215_16%_58%)]";
    default:
      return "text-[hsl(215_16%_58%)]";
  }
}

function renderJson(json: string) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(json)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > cursor) {
      nodes.push(<span key={`gap-${cursor}`}>{json.slice(cursor, start)}</span>);
    }
    const tone = classify(token, json, start + token.length);
    nodes.push(
      <span key={`tok-${start}`} className={toneClass(tone)}>
        {token}
      </span>,
    );
    cursor = start + token.length;
  }

  if (cursor < json.length) {
    nodes.push(<span key={`gap-${cursor}`}>{json.slice(cursor)}</span>);
  }

  return nodes;
}

// Converts a textual cell into its natural JSON value based on the column's type
// category, so the JSON view shows numbers/booleans/json/null unquoted instead of
// stringifying everything.
function coerceCell(value: string | null, category: ColumnTypeCategory): unknown {
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

export function JsonView({ queryResult }: { queryResult: QueryResult | null }) {
  const { t } = useI18n();
  if (!queryResult || queryResult.columns.length === 0)
    return <EmptyPanel text={t("results.emptyGrid")} />;

  const objects = queryResult.rows.map((row) =>
    Object.fromEntries(
      queryResult.columns.map((column, index) => [
        column,
        coerceCell(row[index], queryResult.columnTypes[index] ?? "string"),
      ]),
    ),
  );
  const json = JSON.stringify(objects, null, 2);

  return (
    <div className="h-full overflow-auto bg-[hsl(var(--panel-soft)/0.2)] p-3">
      <div className="min-h-full rounded-md border border-border/70 bg-[hsl(var(--panel-soft)/0.74)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.03),0_10px_24px_hsl(220_35%_6%/0.18)]">
        <pre className="min-h-full overflow-auto p-3 font-mono text-[12px] leading-6 text-[hsl(215_20%_78%)]">
          <code>{renderJson(json)}</code>
        </pre>
      </div>
    </div>
  );
}
