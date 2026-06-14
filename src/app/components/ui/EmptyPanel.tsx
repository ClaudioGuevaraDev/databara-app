export function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}
