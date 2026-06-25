import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "../../../lib/utils";

// Draggable separator that resizes an adjacent panel. The parent owns the
// positioning (pass `className` with the absolute anchor) and the current
// `value`; this component only translates pointer movement into clamped values:
// `onResize` fires live during the drag, `onCommit` once on release.
export function ResizeHandle({
  axis,
  value,
  min,
  max,
  inverted,
  onResize,
  onCommit,
  ariaLabel,
  className,
  style,
}: {
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  // When true, dragging toward smaller coordinates increases the value (used
  // for the bottom panel, whose top edge grows the panel as it moves up).
  inverted?: boolean;
  onResize: (next: number) => void;
  onCommit: (next: number) => void;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const drag = useRef<{ origin: number; value: number; latest: number } | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = axis === "x" ? event.clientX : event.clientY;
    drag.current = { origin, value, latest: value };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    const current = axis === "x" ? event.clientX : event.clientY;
    const delta = inverted ? state.origin - current : current - state.origin;
    const next = clamp(state.value + delta);
    state.latest = next;
    onResize(next);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    onCommit(state.latest);
  }

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={style}
      className={cn(
        // Invisible hit area; the native resize cursor is the affordance.
        "z-10 touch-none select-none bg-transparent",
        axis === "x" ? "h-full w-1.5 cursor-col-resize" : "h-1.5 w-full cursor-row-resize",
        className,
      )}
    />
  );
}
