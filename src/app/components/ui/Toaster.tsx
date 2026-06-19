import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import { useToast } from "../../workspace/workspaceCore";

const toneStyles: Record<string, string> = {
  default: "border-border bg-[hsl(var(--panel))] text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/12 text-emerald-100",
  warning: "border-destructive/45 bg-destructive/12 text-destructive-foreground",
};

export function Toaster() {
  const toast = useToast();
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setDismissedId(toast.id), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast || dismissedId === toast.id) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-0.5 z-50 -translate-x-1/2">
      <div
        className={cn(
          "pointer-events-auto max-w-sm rounded-md border px-3 py-2 text-[12px] shadow-lg",
          toneStyles[toast.tone] ?? toneStyles.default,
        )}
      >
        {toast.text}
      </div>
    </div>
  );
}
