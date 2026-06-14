export function DetailRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-border/70 py-1.5 text-[12px]">
      <div className="truncate font-mono text-foreground">{name}</div>
      <div className="truncate text-muted-foreground">{value}</div>
    </div>
  );
}
