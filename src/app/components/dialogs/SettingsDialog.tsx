import { Database, Minus, Plus, RotateCcw, Settings, SlidersHorizontal, Type } from "lucide-react";
import { useState, type ComponentType } from "react";
import {
  BOTTOM_PANEL_HEIGHT_MAX,
  BOTTOM_PANEL_HEIGHT_MIN,
  BOTTOM_PANEL_HEIGHT_STEP,
  defaultAppSettings,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_STEP,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_STEP,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  type AppSettings,
} from "../../databaraService";
import { cn } from "../../../lib/utils";
import type { NotificationPosition } from "../../types";
import { useSettings } from "../../workspace/workspaceCore";
import {
  DialogActions,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  SelectField,
  Switch,
  type SelectFieldOption,
} from "../ui";

const NOTIFICATION_POSITION_OPTIONS: SelectFieldOption<NotificationPosition>[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

type SettingsTab = "general" | "editor" | "connections";

const TABS: { id: SettingsTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "editor", label: "Editor", icon: Type },
  { id: "connections", label: "Connections", icon: Database },
];

// Which AppSettings keys each tab owns — used to reset only the active tab.
const TAB_RESET_KEYS: Record<SettingsTab, (keyof AppSettings)[]> = {
  general: ["zoom", "notificationPosition", "sidebarWidth", "bottomPanelHeight"],
  editor: ["editorFontSize"],
  connections: ["keepConnectionsActive"],
};

const ALL_SETTINGS_KEYS = Object.keys(defaultAppSettings) as (keyof AppSettings)[];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const {
    settings,
    setZoomLevel,
    setKeepConnectionsActive,
    setEditorFontSize,
    setNotificationPosition,
    setSidebarWidth,
    setBottomPanelHeight,
    resetSettings,
    resetSettingsKeys,
  } = useSettings();
  const { level } = settings.zoom;
  const keepConnectionsActive = settings.keepConnectionsActive.enabled;
  const { size: editorFontSize } = settings.editorFontSize;
  const { position: notificationPosition } = settings.notificationPosition;
  const { width: sidebarWidth } = settings.sidebarWidth;
  const { height: bottomPanelHeight } = settings.bottomPanelHeight;
  const [tab, setTab] = useState<SettingsTab>("general");

  const isDefault = (keys: (keyof AppSettings)[]) =>
    keys.every((key) => JSON.stringify(settings[key]) === JSON.stringify(defaultAppSettings[key]));
  const allAreDefault = isDefault(ALL_SETTINGS_KEYS);

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
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const tabIsDefault = isDefault(TAB_RESET_KEYS[id]);
            return (
              <div key={id} className="relative">
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded pl-2.5 pr-8 text-left text-[12.5px] transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon size={14} />
                  <span className="truncate">{label}</span>
                </button>
                {active ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      resetSettingsKeys(TAB_RESET_KEYS[id]);
                    }}
                    disabled={tabIsDefault}
                    title={`Reset ${label} to defaults`}
                    aria-label={`Reset ${label} to defaults`}
                    className="group absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/0.14)] disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <RotateCcw
                      size={13}
                      className="transition-transform duration-300 group-hover:-rotate-90 group-disabled:rotate-0"
                    />
                  </button>
                ) : null}
              </div>
            );
          })}
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
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">Notifications</div>
                  <div className="text-muted-foreground">Where on-screen toasts appear.</div>
                </div>
                <SelectField
                  label=""
                  className="w-36 justify-self-end"
                  value={notificationPosition}
                  onChange={setNotificationPosition}
                  options={NOTIFICATION_POSITION_OPTIONS}
                />
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">Sidebar width</div>
                  <div className="text-muted-foreground">Width of the explorer sidebar.</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title="Decrease sidebar width"
                    disabled={sidebarWidth <= SIDEBAR_WIDTH_MIN}
                    onClick={() => setSidebarWidth(sidebarWidth - SIDEBAR_WIDTH_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center font-mono text-[13px] tabular-nums text-foreground">
                    {sidebarWidth}
                  </span>
                  <button
                    type="button"
                    title="Increase sidebar width"
                    disabled={sidebarWidth >= SIDEBAR_WIDTH_MAX}
                    onClick={() => setSidebarWidth(sidebarWidth + SIDEBAR_WIDTH_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    Bottom panel height
                  </div>
                  <div className="text-muted-foreground">Height of the results panel.</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title="Decrease bottom panel height"
                    disabled={bottomPanelHeight <= BOTTOM_PANEL_HEIGHT_MIN}
                    onClick={() =>
                      setBottomPanelHeight(bottomPanelHeight - BOTTOM_PANEL_HEIGHT_STEP)
                    }
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center font-mono text-[13px] tabular-nums text-foreground">
                    {bottomPanelHeight}
                  </span>
                  <button
                    type="button"
                    title="Increase bottom panel height"
                    disabled={bottomPanelHeight >= BOTTOM_PANEL_HEIGHT_MAX}
                    onClick={() =>
                      setBottomPanelHeight(bottomPanelHeight + BOTTOM_PANEL_HEIGHT_STEP)
                    }
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
        <button
          type="button"
          onClick={resetSettings}
          disabled={allAreDefault}
          className="group mr-auto flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <RotateCcw
            size={12}
            className="transition-transform duration-300 group-hover:-rotate-90 group-disabled:rotate-0"
          />
          Reset all settings
        </button>
        <button onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
          Close
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
