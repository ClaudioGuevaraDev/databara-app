import { listen } from "@tauri-apps/api/event";

// The splash window is presentational: it renders real startup progress pushed
// by the main (hidden) window over the STARTUP_PROGRESS_EVENT. The displayed
// value eases toward the latest target so discrete milestones (a connection
// finishing, the update check resolving) read as a smooth count-up.

const STARTUP_PROGRESS_EVENT = "databara://startup-progress";

const percentEl = document.querySelector<HTMLElement>(".percent .value");

let target = 0;
let shown = 0;
let raf = 0;

function render() {
  if (percentEl) percentEl.textContent = String(Math.round(shown));
}

function tick() {
  const delta = target - shown;
  if (Math.abs(delta) < 0.5) {
    shown = target;
    render();
    raf = 0;
    return;
  }
  shown += delta * 0.14;
  render();
  raf = requestAnimationFrame(tick);
}

function setTarget(next: number) {
  target = Math.max(0, Math.min(100, next));
  if (!raf) raf = requestAnimationFrame(tick);
}

render();

if ("__TAURI_INTERNALS__" in window) {
  void listen<{ percent: number }>(STARTUP_PROGRESS_EVENT, (event) => {
    setTarget(event.payload.percent);
  });
} else {
  // Browser preview (`pnpm run dev`): no events arrive, so animate a demo fill.
  window.setTimeout(() => setTarget(100), 400);
}
