import { cn } from "../../../lib/utils";

export function Field({
  autoFocus,
  className,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoFocus?: boolean;
  className?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-[12px] text-muted-foreground", className)}>
      {label}
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 rounded border border-border bg-[hsl(var(--panel-soft))] px-2 text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
