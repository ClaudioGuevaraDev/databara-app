import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../../lib/utils";

export type SelectFieldOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
};

export function SelectField<TValue extends string>({
  className,
  label,
  onChange,
  options,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: TValue) => void;
  options: SelectFieldOption<TValue>[];
  value: TValue;
}) {
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const fieldRef = useRef<HTMLLabelElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function selectOption(option: SelectFieldOption<TValue>) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <label
      ref={fieldRef}
      className={cn("relative grid gap-1.5 text-[12px] text-muted-foreground", className)}
    >
      {label}
      <button
        id={fieldId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "group flex min-h-9 items-center justify-between gap-3 rounded border border-border bg-[hsl(var(--panel-soft))] px-2.5 text-left text-foreground outline-none transition-colors duration-150",
          "hover:border-primary/35 hover:bg-[hsl(var(--panel-soft)/0.92)]",
          "focus:border-primary",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold">
              {selectedOption.label}
            </span>
            {selectedOption.description ? (
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {selectedOption.description}
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors group-hover:text-primary">
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-150", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-labelledby={fieldId}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded border border-border bg-[hsl(var(--panel-raised))] p-1 shadow-[0_12px_32px_hsl(220_30%_3%/0.38)]"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectOption(option)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] transition-colors",
                  selected
                    ? "bg-[hsl(var(--primary)/0.13)] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-[hsl(var(--background)/0.36)]",
                  )}
                >
                  {selected ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </label>
  );
}
