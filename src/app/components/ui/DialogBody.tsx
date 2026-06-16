import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
