import type { ReactNode } from "react";

export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
      {children}
    </div>
  );
}
