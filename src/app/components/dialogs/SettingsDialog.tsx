import { Minus, Plus, Settings } from "lucide-react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../databaraService";
import { useSettings } from "../../workspace/workspaceCore";
import { DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, setZoomLevel } = useSettings();
  const { level } = settings.zoom;

  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            <Settings size={16} className="shrink-0 text-primary" />
            <span className="truncate">Settings</span>
          </>
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <DialogBody className="grid gap-4 text-[12px]">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <div className="text-[13px] font-semibold text-foreground">Zoom</div>
            <div className="text-muted-foreground">Scale the entire interface. 100% is normal.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Zoom out"
              disabled={level <= ZOOM_MIN}
              onClick={() => setZoomLevel(level - ZOOM_STEP)}
              className="control flex h-8 w-8 items-center justify-center rounded"
            >
              <Minus size={14} />
            </button>
            <span className="w-12 text-center font-mono text-[13px] text-foreground tabular-nums">
              {level}%
            </span>
            <button
              type="button"
              title="Zoom in"
              disabled={level >= ZOOM_MAX}
              onClick={() => setZoomLevel(level + ZOOM_STEP)}
              className="control flex h-8 w-8 items-center justify-center rounded"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </DialogBody>
    </DialogFrame>
  );
}
