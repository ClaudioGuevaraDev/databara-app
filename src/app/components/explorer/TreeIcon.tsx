import { Braces, Database, Folder, Server, Table2 } from "lucide-react";
import type { DatabaseObjectKind } from "../../types";

export function TreeIcon({
  kind,
  className,
  isServer,
}: {
  className: string;
  kind: DatabaseObjectKind;
  isServer?: boolean;
}) {
  // Server group nodes reuse the "database" kind, so distinguish them explicitly.
  if (isServer) return <Server size={14} className={className} />;
  if (kind === "schema") return <Folder size={14} className={className} />;
  if (kind === "view") return <Braces size={14} className={className} />;
  if (kind === "table") return <Table2 size={14} className={className} />;
  return <Database size={14} className={className} />;
}
