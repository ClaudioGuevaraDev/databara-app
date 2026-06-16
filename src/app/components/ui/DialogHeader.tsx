import type { ReactNode } from "react";

export function DialogHeader({ children, title }: { children?: ReactNode; title: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2 font-medium">{title}</div>
      {children}
    </div>
  );
}
