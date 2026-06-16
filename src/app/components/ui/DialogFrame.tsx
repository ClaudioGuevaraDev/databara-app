import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function DialogFrame({ children, maxWidth }: { children: ReactNode; maxWidth: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
      <div
        className={cn(
          "chrome-panel hairline w-full rounded border border-border shadow-2xl",
          maxWidth,
        )}
      >
        {children}
      </div>
    </div>
  );
}
