import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function IconButton({
  active,
  children,
  className,
  disabled,
  title,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35",
        active && "bg-[hsl(var(--primary)/0.14)] text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
