import { Database, Minus, Plus, Settings, SlidersHorizontal, Type } from "lucide-react";
import { useState, type ComponentType } from "react";
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_STEP,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "../../databaraService";
import { cn } from "../../../lib/utils";
import { useSettings } from "../../workspace/workspaceCore";
import { DialogActions, DialogCloseButton, DialogFrame, DialogHeader, Switch } from "../ui";

type SettingsTab = "general" | "editor" | "connections";

const TABS: { id: SettingsTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "editor", label: "Editor", icon: Type },
  { id: "connections", label: "Connections", icon: Database },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, setZoomLevel, setKeepConnectionsActive, setEditorFontSize } = useSettings();
  const { level } = settings.zoom;
  const keepConnectionsActive = settings.keepConnectionsActive.enabled;
  const { size: editorFontSize } = settings.editorFontSize;
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <DialogFrame maxWidth="max-w-[640px]">
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
      <div className="flex">
        <nav className="w-44 shrink-0 border-r border-border p-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded px-2.5 text-left text-[12.5px] transition-colors",
                tab === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={14} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="min-h-[220px] flex-1 p-4">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-5 text-[12px]">
            {tab === "general" ? (
              <>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">Zoom</div>
                  <div className="text-muted-foreground">
                    Scale the entire interface. 100% is normal.
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title="Zoom out"
                    disabled={level <= ZOOM_MIN}
                    onClick={() => setZoomLevel(level - ZOOM_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center font-mono text-[13px] tabular-nums text-foreground">
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
              </>
            ) : null}
            {tab === "editor" ? (
              <>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">Font size</div>
                  <div className="text-muted-foreground">Font size of the SQL editor.</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title="Decrease font size"
                    disabled={editorFontSize <= EDITOR_FONT_SIZE_MIN}
                    onClick={() => setEditorFontSize(editorFontSize - EDITOR_FONT_SIZE_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center font-mono text-[13px] tabular-nums text-foreground">
                    {editorFontSize}
                  </span>
                  <button
                    type="button"
                    title="Increase font size"
                    disabled={editorFontSize >= EDITOR_FONT_SIZE_MAX}
                    onClick={() => setEditorFontSize(editorFontSize + EDITOR_FONT_SIZE_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </>
            ) : null}
            {tab === "connections" ? (
              <>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    Keep connections active
                  </div>
                  <div className="text-muted-foreground">
                    Reconnect saved connections on startup without asking for the password. The
                    password is stored in your operating system's keychain.
                  </div>
                </div>
                <div className="justify-self-end">
                  <Switch
                    checked={keepConnectionsActive}
                    label="Keep connections active"
                    onChange={setKeepConnectionsActive}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <DialogActions>
        <button onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
          Close
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
