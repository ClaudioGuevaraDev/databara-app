import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

// Shared inline alert for dialog forms — replaces the bare red error text with a
// tinted, bordered callout (icon + message). Two tones: "error" and "success".
export function FormAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-[12px] leading-snug",
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] text-destructive",
        className,
      )}
    >
      <Icon size={14} className="mt-px shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
