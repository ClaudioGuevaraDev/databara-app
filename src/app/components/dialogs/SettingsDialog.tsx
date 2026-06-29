import {
  Database,
  HardDrive,
  Minus,
  Plus,
  Settings,
  SlidersHorizontal,
  Type,
  Undo2,
} from "lucide-react";
import { type ComponentType } from "react";
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
import { useI18n } from "../../i18n/I18nContext";
import type { TranslationKey } from "../../i18n/translate";
import type { Language, NotificationPosition } from "../../types";
import { useSettings, type SettingsTab } from "../../workspace/workspaceCore";
import {
  DialogActions,
  DialogCloseButton,
  DialogFrame,
  DialogHeader,
  SelectField,
  Switch,
  type SelectFieldOption,
} from "../ui";
import { StorageSettingsTab } from "./StorageSettingsTab";

const NOTIFICATION_POSITION_VALUES: NotificationPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const LANGUAGE_VALUES: Language[] = ["en"];

const TABS: {
  id: SettingsTab;
  labelKey: TranslationKey;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: SlidersHorizontal },
  { id: "editor", labelKey: "settings.tabs.editor", icon: Type },
  { id: "connections", labelKey: "settings.tabs.connections", icon: Database },
  { id: "storage", labelKey: "settings.tabs.storage", icon: HardDrive },
];

// Which AppSettings keys each tab owns — used to reset only the active tab.
const TAB_RESET_KEYS: Record<SettingsTab, (keyof AppSettings)[]> = {
  general: ["zoom", "notificationPosition", "language", "sidebarWidth", "bottomPanelHeight"],
  editor: ["editorFontSize"],
  connections: ["keepConnectionsActive", "activateSiblingConnections", "discoverServerDatabases"],
  storage: ["exportIncludesPasswords"],
};

const ALL_SETTINGS_KEYS = Object.keys(defaultAppSettings) as (keyof AppSettings)[];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const {
    settings,
    settingsTab: tab,
    setSettingsTab: setTab,
    setZoomLevel,
    setKeepConnectionsActive,
    setActivateSiblingConnections,
    setDiscoverServerDatabases,
    setEditorFontSize,
    setNotificationPosition,
    setLanguage,
    setSidebarWidth,
    setBottomPanelHeight,
    resetSettings,
    resetSettingsKeys,
  } = useSettings();
  const { level } = settings.zoom;
  const keepConnectionsActive = settings.keepConnectionsActive.enabled;
  const activateSiblingConnections = settings.activateSiblingConnections.enabled;
  const discoverServerDatabases = settings.discoverServerDatabases.enabled;
  const { size: editorFontSize } = settings.editorFontSize;
  const { position: notificationPosition } = settings.notificationPosition;
  const { code: language } = settings.language;
  const { width: sidebarWidth } = settings.sidebarWidth;
  const { height: bottomPanelHeight } = settings.bottomPanelHeight;

  const notificationPositionOptions: SelectFieldOption<NotificationPosition>[] =
    NOTIFICATION_POSITION_VALUES.map((value) => ({
      value,
      label: t(`settings.notificationPositions.${value}` as TranslationKey),
    }));
  const languageOptions: SelectFieldOption<Language>[] = LANGUAGE_VALUES.map((value) => ({
    value,
    label: t(`settings.languages.${value}` as TranslationKey),
  }));

  const isDefault = (keys: (keyof AppSettings)[]) =>
    keys.every((key) => JSON.stringify(settings[key]) === JSON.stringify(defaultAppSettings[key]));
  const allAreDefault = isDefault(ALL_SETTINGS_KEYS);

  return (
    <DialogFrame maxWidth="max-w-[640px]">
      <DialogHeader
        title={
          <>
            <Settings size={16} className="shrink-0 text-primary" />
            <span className="truncate">{t("settings.title")}</span>
          </>
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex">
        <nav className="w-44 shrink-0 border-r border-border p-2">
          {TABS.map(({ id, labelKey, icon: Icon }) => {
            const active = tab === id;
            const tabIsDefault = isDefault(TAB_RESET_KEYS[id]);
            const label = t(labelKey);
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
                    title={t("settings.resetTab", { tab: label })}
                    aria-label={t("settings.resetTab", { tab: label })}
                    className="group absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/0.14)] disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Undo2
                      size={13}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
                  </button>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="scroll-overlay h-[320px] flex-1 overflow-y-auto p-4">
          {tab === "storage" ? <StorageSettingsTab /> : null}
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-5 text-[12px]">
            {tab === "general" ? (
              <>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.language.title")}
                  </div>
                  <div className="text-muted-foreground">{t("settings.language.description")}</div>
                </div>
                <SelectField
                  label=""
                  className="w-36 justify-self-end"
                  value={language}
                  onChange={setLanguage}
                  options={languageOptions}
                />
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.notifications.title")}
                  </div>
                  <div className="text-muted-foreground">
                    {t("settings.notifications.description")}
                  </div>
                </div>
                <SelectField
                  label=""
                  className="w-36 justify-self-end"
                  value={notificationPosition}
                  onChange={setNotificationPosition}
                  options={notificationPositionOptions}
                />
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.zoom.title")}
                  </div>
                  <div className="text-muted-foreground">{t("settings.zoom.description")}</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title={t("settings.zoom.out")}
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
                    title={t("settings.zoom.in")}
                    disabled={level >= ZOOM_MAX}
                    onClick={() => setZoomLevel(level + ZOOM_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.sidebar.title")}
                  </div>
                  <div className="text-muted-foreground">{t("settings.sidebar.description")}</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title={t("settings.sidebar.decrease")}
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
                    title={t("settings.sidebar.increase")}
                    disabled={sidebarWidth >= SIDEBAR_WIDTH_MAX}
                    onClick={() => setSidebarWidth(sidebarWidth + SIDEBAR_WIDTH_STEP)}
                    className="control flex h-8 w-8 items-center justify-center rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.bottomPanel.title")}
                  </div>
                  <div className="text-muted-foreground">
                    {t("settings.bottomPanel.description")}
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title={t("settings.bottomPanel.decrease")}
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
                    title={t("settings.bottomPanel.increase")}
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
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.fontSize.title")}
                  </div>
                  <div className="text-muted-foreground">{t("settings.fontSize.description")}</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    title={t("settings.fontSize.decrease")}
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
                    title={t("settings.fontSize.increase")}
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
                    {t("settings.keepConnections.title")}
                  </div>
                  <div className="text-muted-foreground">
                    {t("settings.keepConnections.description")}
                  </div>
                </div>
                <div className="justify-self-end">
                  <Switch
                    checked={keepConnectionsActive}
                    label={t("settings.keepConnections.title")}
                    onChange={setKeepConnectionsActive}
                  />
                </div>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.activateSiblingConnections.title")}
                  </div>
                  <div className="text-muted-foreground">
                    {t("settings.activateSiblingConnections.description")}
                  </div>
                </div>
                <div className="justify-self-end">
                  <Switch
                    checked={activateSiblingConnections}
                    label={t("settings.activateSiblingConnections.title")}
                    onChange={setActivateSiblingConnections}
                  />
                </div>
                <div className="grid gap-0.5">
                  <div className="text-[13px] font-semibold text-foreground">
                    {t("settings.discoverServerDatabases.title")}
                  </div>
                  <div className="text-muted-foreground">
                    {t("settings.discoverServerDatabases.description")}
                  </div>
                </div>
                <div className="justify-self-end">
                  <Switch
                    checked={discoverServerDatabases}
                    label={t("settings.discoverServerDatabases.title")}
                    onChange={setDiscoverServerDatabases}
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
          className="group -ml-2 mr-auto flex h-8 items-center gap-1.5 rounded pl-2.5 pr-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <Undo2
            size={12}
            className="transition-transform duration-200 group-hover:-translate-x-0.5 group-disabled:translate-x-0"
          />
          {t("settings.resetAll")}
        </button>
        <button onClick={onClose} className="control h-8 rounded px-3 text-[12px]">
          {t("common.close")}
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
