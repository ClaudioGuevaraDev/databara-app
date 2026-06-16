import type { DatabaseObjectDetails } from "../../types";
import { formatColumn } from "../../workspace/workspaceCore";
import { DetailRow, EmptyPanel } from "../ui";

export function ColumnsView({ details }: { details: DatabaseObjectDetails | null }) {
  if (!details) return <EmptyPanel text="Select an object to inspect columns." />;

  return (
    <div className="p-3">
      {details.columns.map((column) => (
        <DetailRow key={column.name} name={column.name} value={formatColumn(column)} />
      ))}
    </div>
  );
}
