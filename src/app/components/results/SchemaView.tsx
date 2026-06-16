import type { ReactNode } from "react";
import type { DatabaseObjectDetails } from "../../types";
import { EmptyPanel } from "../ui";
import { buildObjectSchema } from "./objectSchema";

type SqlTokenTone = "keyword" | "type" | "identifier" | "muted" | "plain";

function renderSql(sql: string) {
  const lines = sql.split("\n");

  return lines.map((line, lineIndex) => {
    const tokens = line.match(/"[^"]*"|\b[A-Za-z_][A-Za-z0-9_]*\b|[.,();*]/g) ?? [];
    const renderedTokens: ReactNode[] = [];
    let cursor = 0;

    for (const token of tokens) {
      const start = line.indexOf(token, cursor);
      if (start > cursor) {
        renderedTokens.push(
          <span key={`${lineIndex}-${cursor}-gap`} className="text-[hsl(215_20%_72%)]">
            {line.slice(cursor, start)}
          </span>,
        );
      }

      renderedTokens.push(
        <span
          key={`${lineIndex}-${start}-${token}`}
          className={tokenToneClass(getTokenTone(token))}
        >
          {token}
        </span>,
      );
      cursor = start + token.length;
    }

    if (cursor < line.length) {
      renderedTokens.push(
        <span key={`${lineIndex}-${cursor}-tail`} className="text-[hsl(215_20%_72%)]">
          {line.slice(cursor)}
        </span>,
      );
    }

    return (
      <div key={`${lineIndex}-${line}`} className="whitespace-pre">
        {renderedTokens.length > 0 ? renderedTokens : <span>&nbsp;</span>}
      </div>
    );
  });
}

function getTokenTone(token: string): SqlTokenTone {
  const normalized = token.toUpperCase();

  if (
    [
      "AS",
      "CREATE",
      "FROM",
      "INDEX",
      "NOT",
      "NULL",
      "ON",
      "PRIMARY",
      "KEY",
      "SELECT",
      "TABLE",
      "UNIQUE",
      "VIEW",
    ].includes(normalized)
  ) {
    return "keyword";
  }

  if (
    [
      "BIGINT",
      "BOOLEAN",
      "DATE",
      "INTEGER",
      "JSON",
      "JSONB",
      "TEXT",
      "TIMESTAMPTZ",
      "UUID",
    ].includes(normalized)
  ) {
    return "type";
  }

  if (
    token === "." ||
    token === "," ||
    token === "(" ||
    token === ")" ||
    token === ";" ||
    token === "*"
  ) {
    return "muted";
  }

  if (token.startsWith('"') && token.endsWith('"')) {
    return "identifier";
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    return "identifier";
  }

  return "plain";
}

function tokenToneClass(tone: SqlTokenTone) {
  switch (tone) {
    case "keyword":
      return "font-semibold text-[hsl(22_95%_72%)]";
    case "type":
      return "text-[hsl(188_72%_72%)]";
    case "identifier":
      return "text-[hsl(210_20%_92%)]";
    case "muted":
      return "text-[hsl(215_16%_58%)]";
    default:
      return "text-[hsl(215_20%_78%)]";
  }
}

export function SchemaView({ details }: { details: DatabaseObjectDetails | null }) {
  if (!details) return <EmptyPanel text="Select an object to inspect its schema." />;

  const schemaSql = buildObjectSchema(details);

  return (
    <div className="h-full overflow-auto bg-[hsl(var(--panel-soft)/0.2)] p-3">
      <div className="min-h-full rounded-md border border-[hsl(218_20%_20%/0.6)] bg-[hsl(222_22%_12%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.03),0_10px_24px_hsl(220_35%_6%/0.18)]">
        <pre className="min-h-full overflow-auto p-3 font-mono text-[12px] leading-6">
          <code>{renderSql(schemaSql)}</code>
        </pre>
      </div>
    </div>
  );
}
