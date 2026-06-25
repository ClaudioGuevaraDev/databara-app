import { useI18n } from "../../i18n/I18nContext";
import type { DatabaseObjectDetails } from "../../types";
import { EmptyPanel } from "../ui";

function MetaBadge({
  children,
  tone = "default",
}: {
  children: string;
  tone?: "default" | "primary";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/25 bg-primary/10 text-primary"
      : "border-border/70 bg-[hsl(var(--panel-soft)/0.74)] text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function ColumnsView({ details }: { details: DatabaseObjectDetails | null }) {
  const { t } = useI18n();
  if (!details) return <EmptyPanel text={t("results.emptyColumns")} />;

  return (
    <div className="h-full overflow-auto p-3">
      {details.columns.map((column, index) => (
        <div
          key={column.name}
          className="grid grid-cols-[28px_120px_1fr] gap-3 border-b border-border/60 py-2 text-[12px] last:border-b-0"
        >
          <div className="pt-0.5 text-right font-mono text-[10px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div
            className={`truncate font-mono ${column.indexed ? "text-primary" : "text-foreground"}`}
          >
            {column.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <MetaBadge>{column.dataType}</MetaBadge>
            <MetaBadge tone={column.primaryKey ? "primary" : "default"}>
              {column.primaryKey
                ? t("traits.primaryKey")
                : column.nullable
                  ? t("traits.nullable")
                  : t("traits.notNull")}
            </MetaBadge>
            {!column.primaryKey && !column.nullable ? (
              <MetaBadge>{t("traits.notNull")}</MetaBadge>
            ) : null}
            {column.indexed ? <MetaBadge tone="primary">{t("traits.indexed")}</MetaBadge> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
