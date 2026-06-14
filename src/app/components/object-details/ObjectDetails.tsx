import { Braces, Copy, FileCode2, RefreshCw, Table2 } from "lucide-react";
import type { DatabaseObjectDetails } from "../../types";
import { formatColumn, formatIndex, useObjectDetailsPanel } from "../../workspaceCore";
import { DetailRow, EmptyPanel, MetricMini, SectionTitle, SmallAction } from "../ui";

export function ObjectDetailsPanel() {
  const objectDetails = useObjectDetailsPanel();

  return (
    <ObjectDetails
      details={objectDetails.details}
      onCopyName={() => void objectDetails.copyObjectName()}
      onLoadDdl={() => void objectDetails.loadDdl()}
      onPreview={() => void objectDetails.previewObject()}
      onRefresh={() => void objectDetails.refreshAll()}
    />
  );
}

function ObjectDetails({
  details,
  onCopyName,
  onLoadDdl,
  onPreview,
  onRefresh,
}: {
  details: DatabaseObjectDetails | null;
  onCopyName: () => void;
  onLoadDdl: () => void;
  onPreview: () => void;
  onRefresh: () => void;
}) {
  if (!details) {
    return (
      <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
        <EmptyPanel text="Select an object to inspect details." />
      </aside>
    );
  }

  const objectLabel = `${details.schema}.${details.name}`;
  const objectKindLabel = details.kind === "view" ? "View" : "Table";

  return (
    <aside className="chrome-panel flex min-h-0 flex-col border-l border-border">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-primary/25 bg-primary/10">
            {details.kind === "view" ? (
              <Braces size={17} className="text-primary" />
            ) : (
              <Table2 size={17} className="text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{objectLabel}</div>
            <div className="text-[12px] text-muted-foreground">
              {objectKindLabel} - {details.engine}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border text-center text-[11px]">
        <MetricMini value={String(details.columns.length)} label="cols" />
        <MetricMini value={String(details.indexes.length)} label="indexes" />
        <MetricMini value={details.safeEdit ? "PK" : "RO"} label="safe edit" amber />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <SectionTitle>Columns</SectionTitle>
        {details.columns.map((column) => (
          <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
        ))}

        <SectionTitle className="mt-5">Indexes</SectionTitle>
        {details.indexes.length > 0 ? (
          details.indexes.map((index) => (
            <DetailRow key={index.name} name={index.name} value={formatIndex(index)} />
          ))
        ) : (
          <div className="text-[12px] text-muted-foreground">No indexes for this object</div>
        )}

        <SectionTitle className="mt-5">Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <SmallAction icon={Table2} label="Preview" onClick={onPreview} />
          <SmallAction icon={FileCode2} label="DDL" onClick={onLoadDdl} />
          <SmallAction icon={RefreshCw} label="Refresh" onClick={onRefresh} />
          <SmallAction icon={Copy} label="Copy name" onClick={onCopyName} />
        </div>
      </div>
    </aside>
  );
}
