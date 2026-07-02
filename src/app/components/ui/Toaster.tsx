import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import type { NotificationPosition, ToastTone } from "../../types";
import { useSettings, useToast } from "../../workspace/workspaceCore";

// Dark keeps the pristine original look (subtle tint, no icon/ring/animation);
// light gets a solid, high-contrast fill with a leading icon and entrance
// animation. The two are rendered as separate branches so neither leaks into
// the other.
const darkToneStyles: Record<ToastTone, string> = {
  default: "border-border bg-[hsl(var(--panel))] text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/12 text-emerald-100",
  warning: "border-destructive/45 bg-destructive/12 text-destructive-foreground",
};

const lightToneStyles: Record<ToastTone, string> = {
  default: "border-border bg-[hsl(var(--panel))] text-foreground ring-black/10",
  success: "border-emerald-600 bg-emerald-600 text-white ring-white/15",
  warning: "border-red-600 bg-red-600 text-white ring-white/15",
};

const toneIcons: Record<ToastTone, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const positionStyles: Record<NotificationPosition, string> = {
  "top-left": "top-1 left-2",
  "top-center": "top-1 left-1/2 -translate-x-1/2",
  "top-right": "top-1 right-2",
  "bottom-left": "bottom-7 left-2",
  "bottom-center": "bottom-7 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-7 right-2",
};

export function Toaster() {
  const toast = useToast();
  const { settings } = useSettings();
  const themePreference = settings.theme.preference;

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    if (themePreference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themePreference]);
  const isDark = themePreference === "dark" || (themePreference === "system" && systemDark);

  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setDismissedId(toast.id), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast || dismissedId === toast.id) return null;

  const positionClass = positionStyles[settings.notificationPosition.position];

  // Dark: the original plain tinted box — no icon, ring, or entrance animation.
  if (isDark) {
    return (
      <div className={cn("pointer-events-none fixed z-50", positionClass)}>
        <div
          className={cn(
            "pointer-events-auto max-w-sm rounded-md border px-3 py-2 text-[12px] shadow-lg",
            darkToneStyles[toast.tone] ?? darkToneStyles.default,
          )}
        >
          {toast.text}
        </div>
      </div>
    );
  }

  // Light: solid, prominent, with a leading icon and entrance animation.
  const Icon = toneIcons[toast.tone] ?? toneIcons.default;
  return (
    <div className={cn("pointer-events-none fixed z-50", positionClass)}>
      <div
        className={cn(
          "toast-enter pointer-events-auto flex max-w-sm animate-[toast-in_160ms_ease-out] items-center gap-2 rounded-md border px-3 py-2 text-[12px] shadow-lg ring-1",
          lightToneStyles[toast.tone] ?? lightToneStyles.default,
        )}
      >
        <Icon size={14} className="shrink-0" />
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
