import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import type { NotificationPosition } from "../../types";
import { useSettings, useToast } from "../../workspace/workspaceCore";

const toneStyles: Record<string, string> = {
  default: "border-border bg-[hsl(var(--panel))] text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/12 text-emerald-100",
  warning: "border-destructive/45 bg-destructive/12 text-destructive-foreground",
};

const positionStyles: Record<NotificationPosition, string> = {
  "top-left": "top-1 left-2",
  "top-center": "top-1 left-1/2 -translate-x-1/2",
  "top-right": "top-1 right-2",
  "bottom-left": "bottom-6 left-2",
  "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-6 right-2",
};

export function Toaster() {
  const toast = useToast();
  const { settings } = useSettings();
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setDismissedId(toast.id), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast || dismissedId === toast.id) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50",
        positionStyles[settings.notificationPosition.position],
      )}
    >
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
