import { cn } from "../../../lib/utils";

export function MetricMini({
  amber,
  label,
  value,
}: {
  amber?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[hsl(var(--panel))] px-2 py-2">
      <div className={cn("font-mono text-foreground", amber && "text-amber-300")}>{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
