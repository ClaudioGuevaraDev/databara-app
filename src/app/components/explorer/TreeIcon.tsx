import { Braces, Database, Folder, Table2 } from "lucide-react";
import type { DatabaseObjectKind } from "../../types";

export function TreeIcon({ kind, className }: { className: string; kind: DatabaseObjectKind }) {
  if (kind === "schema") return <Folder size={14} className={className} />;
  if (kind === "view") return <Braces size={14} className={className} />;
  if (kind === "table") return <Table2 size={14} className={className} />;
  return <Database size={14} className={className} />;
}
