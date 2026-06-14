import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
