import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { IconButton } from "./IconButton";

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

export function DialogHeader({ children, title }: { children?: ReactNode; title: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2 font-medium">{title}</div>
      {children}
    </div>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-4">
      {children}
    </div>
  );
}

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton title="Close" onClick={onClick}>
      <X size={15} />
    </IconButton>
  );
}
