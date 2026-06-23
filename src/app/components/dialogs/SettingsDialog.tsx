import { Minus, Plus, Settings } from "lucide-react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../databaraService";
import { useSettings } from "../../workspace/workspaceCore";
import {
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  Switch,
} from "../ui";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, setZoomLevel, setKeepConnectionsActive } = useSettings();
  const { level } = settings.zoom;
  const keepConnectionsActive = settings.keepConnectionsActive.enabled;

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
      <DialogBody className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-5 text-[12px]">
        <div className="grid gap-0.5">
          <div className="text-[13px] font-semibold text-foreground">Zoom</div>
          <div className="text-muted-foreground">Scale the entire interface. 100% is normal.</div>
        </div>
        <div className="flex items-center justify-self-end gap-2">
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
        <div className="grid gap-0.5">
          <div className="text-[13px] font-semibold text-foreground">Keep connections active</div>
          <div className="text-muted-foreground">
            Reconnect saved connections on startup without asking for the password. The password is
            stored in your operating system's keychain.
          </div>
        </div>
        <div className="justify-self-end">
          <Switch
            checked={keepConnectionsActive}
            label="Keep connections active"
            onChange={setKeepConnectionsActive}
          />
        </div>
      </DialogBody>
      <DialogActions>
        <button onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
          Close
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
