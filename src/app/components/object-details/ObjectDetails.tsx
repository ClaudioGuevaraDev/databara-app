import { Braces, Copy, FileCode2, RefreshCw, Table2 } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import type { DatabaseObjectDetails } from "../../types";
import { formatColumn, formatIndex } from "../../workspace/workspaceCore";
import { DetailRow, EmptyPanel, MetricMini, SectionTitle, SmallAction } from "../ui";

export function ObjectDetails({
  details,
  onCopyName,
  onOpenSchema,
  onPreview,
  onRefresh,
}: {
  details: DatabaseObjectDetails | null;
  onCopyName: () => void;
  onOpenSchema: () => void;
  onPreview: () => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  if (!details) {
    return (
      <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
        <EmptyPanel text={t("objectDetails.empty")} />
      </aside>
    );
  }

  const objectLabel = `${details.schema}.${details.name}`;
  const objectKindLabel =
    details.kind === "view" ? t("objectDetails.kind.view") : t("objectDetails.kind.table");

  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-primary/25 bg-primary/10">
            {details.kind === "view" ? (
              <Braces size={17} className="text-primary" />
            ) : (
              <Table2 size={17} className="text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{objectLabel}</div>
            <div className="truncate text-[12px] text-muted-foreground">
              {objectKindLabel} - {details.engine}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <MetricMini value={String(details.columns.length)} label={t("objectDetails.metric.cols")} />
        <MetricMini
          value={String(details.indexes.length)}
          label={t("objectDetails.metric.indexes")}
        />
        <MetricMini
          value={details.safeEdit ? t("objectDetails.metric.pk") : t("objectDetails.metric.ro")}
          label={t("objectDetails.metric.safeEdit")}
          amber
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <SectionTitle>{t("objectDetails.section.columns")}</SectionTitle>
        {details.columns.map((column) => (
          <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
        ))}

        <SectionTitle className="mt-5">{t("objectDetails.section.indexes")}</SectionTitle>
        {details.indexes.length > 0 ? (
          details.indexes.map((index) => (
            <DetailRow key={index.name} name={index.name} value={formatIndex(index)} />
          ))
        ) : (
          <div className="text-[12px] text-muted-foreground">{t("objectDetails.noIndexes")}</div>
        )}

        <SectionTitle className="mt-5">{t("objectDetails.section.actions")}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <SmallAction
            icon={Table2}
            label={t("objectDetails.action.preview")}
            onClick={onPreview}
          />
          <SmallAction
            icon={FileCode2}
            label={t("objectDetails.action.schema")}
            onClick={onOpenSchema}
          />
          <SmallAction
            icon={RefreshCw}
            label={t("objectDetails.action.refresh")}
            onClick={onRefresh}
          />
          <SmallAction
            icon={Copy}
            label={t("objectDetails.action.copyName")}
            onClick={onCopyName}
          />
        </div>
      </div>
    </aside>
  );
}
