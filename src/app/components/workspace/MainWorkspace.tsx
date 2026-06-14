import Editor from "@monaco-editor/react";
import {
  Database,
  FileCode2,
  KeyRound,
  Play,
  Plus,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import type { SqlTab } from "../../types";
import { savedConnectionNodeId, useEmptyWorkspace, useSqlEditor } from "../../workspaceCore";
import { ResultsDock } from "../results/ResultsPanel";
import { IconButton } from "../ui";

export function MainWorkspace({ requiresConnection }: { requiresConnection: boolean }) {
  return (
    <main className="flex min-w-0 flex-col">
      {requiresConnection ? (
        <EmptyWorkspace />
      ) : (
        <>
          <TabsEditor />
          <ResultsDock />
        </>
      )}
    </main>
  );
}

function TabsEditor() {
  const editor = useSqlEditor();

  return (
    <>
      <EditorTabs
        tabs={editor.sqlTabs}
        activeTabId={editor.activeTabId}
        onClose={editor.closeSqlTab}
        onSelect={editor.selectSqlTab}
      />
      <QueryToolbar
        canSave={Boolean(editor.activeTab?.state === "official" && editor.activeTab.dirty)}
        onRun={editor.runQuery}
        onSave={() => void editor.saveActiveSqlTab()}
      />
      <section className="min-h-0 flex-1 bg-[hsl(220_13%_8%)]">
        {editor.activeTab ? (
          <Editor
            key={editor.activeTab.id}
            defaultLanguage="sql"
            value={editor.activeTab.sql}
            theme="vs-dark"
            onChange={(value) => editor.updateActiveSql(value ?? "")}
            onMount={(monacoEditor, monaco) => {
              monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                void editor.saveActiveSqlTab();
              });
            }}
            options={{
              automaticLayout: true,
              fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
              fontSize: 13,
              lineHeight: 21,
              minimap: { enabled: false },
              padding: { bottom: 16, top: 16 },
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        ) : (
          <EmptyEditor />
        )}
      </section>
    </>
  );
}

function EditorTabs({
  activeTabId,
  onClose,
  onSelect,
  tabs,
}: {
  activeTabId: string;
  onClose: (tabId: string) => void;
  onSelect: (tabId: string) => void;
  tabs: SqlTab[];
}) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(viewport.scrollLeft > 0);
    setCanScrollRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }

  function scrollTabs(direction: "left" | "right") {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -240 : 240,
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const activeTabElement = viewport.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    activeTabElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs]);

  return (
    <div className="chrome-panel flex h-9 min-w-0 shrink-0 items-stretch gap-1 border-b border-border px-1">
      <IconButton
        title="Scroll tabs left"
        onClick={() => scrollTabs("left")}
        disabled={!canScrollLeft}
      >
        <ChevronLeft size={15} />
      </IconButton>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          ref={scrollViewportRef}
          onScroll={updateScrollButtons}
          className="flex h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={cn(
                "group flex h-9 max-w-56 shrink-0 items-stretch border-r border-border text-[12.5px] transition-transform",
                activeTabId === tab.id
                  ? "bg-background shadow-[inset_0_2px_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                tab.state === "temporary" && "-skew-x-6 border-r-primary/20 bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 px-3 text-left",
                  tab.state === "temporary" && "skew-x-6",
                )}
              >
                <FileCode2
                  size={14}
                  className={cn(
                    activeTabId === tab.id && "text-primary",
                    tab.state === "temporary" && "opacity-75",
                  )}
                />
                <span className={cn("truncate", tab.state === "temporary" && "italic")}>
                  {tab.label}
                </span>
                {tab.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
              </button>
              <button
                type="button"
                title={`Close ${tab.label}`}
                onClick={() => onClose(tab.id)}
                className={cn(
                  "flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                  activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  tab.state === "temporary" && "skew-x-6",
                )}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <IconButton
        title="Scroll tabs right"
        onClick={() => scrollTabs("right")}
        disabled={!canScrollRight}
      >
        <ChevronRight size={15} />
      </IconButton>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
      Select a table to open SQL.
    </div>
  );
}

function QueryToolbar({
  canSave,
  onRun,
  onSave,
}: {
  canSave: boolean;
  onRun: () => void;
  onSave: () => void;
}) {
  return (
    <div className="chrome-panel flex h-10 shrink-0 items-center border-b border-border px-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onRun}
          className="flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.14)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Play size={14} />
          Run
        </button>
        <button
          onClick={onSave}
          disabled={!canSave}
          className={cn(
            "ml-1 flex h-7 items-center gap-1.5 rounded px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
            canSave
              ? "bg-emerald-500/14 hover:bg-emerald-500/22 text-emerald-200 shadow-[inset_0_0_0_1px_hsl(160_84%_39%/.36)]"
              : "bg-muted/60 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]",
          )}
          title="Save SQL tab"
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  );
}

function EmptyWorkspace() {
  const empty = useEmptyWorkspace();

  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[hsl(220_13%_8%)] px-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.28)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />
      <div className="relative grid w-full max-w-[520px] justify-items-center gap-5 text-center">
        {empty.hasStoredConnections ? <SavedConnectionEmptySvg /> : <NoConnectionEmptySvg />}
        <div className="grid gap-2">
          <h2 className="text-[18px] font-semibold text-foreground">
            {empty.hasStoredConnections ? "No active database connection" : "No connections yet"}
          </h2>
          {empty.hasStoredConnections ? null : (
            <p className="max-w-[460px] text-[13px] leading-6 text-muted-foreground">
              Add a PostgreSQL connection to inspect schemas, tables, views, columns, and indexes.
            </p>
          )}
        </div>
        {empty.hasStoredConnections ? (
          <div className="chrome-panel hairline w-full max-w-[520px] overflow-hidden rounded-lg border border-border text-left shadow-[0_18px_54px_hsl(220_30%_3%/0.34)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-border px-4 py-3">
              <div className="max-w-[280px]">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Saved connections
                  </div>
                  <div className="rounded-full border border-primary/20 bg-[hsl(var(--primary)/0.1)] px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {empty.storedConnections.length}
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Choose a session to unlock the workspace.
                </div>
              </div>
              <button
                type="button"
                onClick={empty.openNewConnectionDialog}
                className="flex h-8 items-center gap-1.5 self-start rounded border border-primary/25 bg-[hsl(var(--primary)/0.08)] px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-[hsl(var(--primary)/0.14)]"
              >
                <Plus size={13} />
                New Connection
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              <div className="grid gap-2">
                {empty.storedConnections.map((connection) => {
                  const nodeId = savedConnectionNodeId(connection);

                  return (
                    <div
                      key={nodeId}
                      className="group flex items-center gap-3 rounded-md border border-border bg-[linear-gradient(180deg,hsl(var(--panel-soft)/0.86),hsl(var(--panel)/0.92))] px-3 py-3 transition-colors hover:border-primary/35"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.08))] text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]">
                        <KeyRound size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {connection.database}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {connection.user}@{connection.host}:{connection.port}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => empty.openSavedConnection(nodeId)}
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-primary/25 bg-[hsl(var(--primary)/0.12)] px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-[hsl(var(--primary)/0.18)]"
                      >
                        <Database size={13} />
                        Connect
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={empty.openNewConnectionDialog}
            className="flex h-9 items-center gap-2 rounded bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.16)] hover:brightness-110"
          >
            <Plus size={15} />
            Connection
          </button>
        )}
      </div>
    </section>
  );
}

function NoConnectionEmptySvg() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 136"
      className="h-28 w-40 text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.16)]"
    >
      <rect
        x="34"
        y="22"
        width="112"
        height="76"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M52 44h76M52 62h52M52 80h64"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 116h64M74 98l-10 18M106 98l10 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="137"
        cy="31"
        r="15"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M131 31h12M137 25v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SavedConnectionEmptySvg() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 136"
      className="h-28 w-40 text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.16)]"
    >
      <rect
        x="28"
        y="26"
        width="52"
        height="70"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="100"
        y="26"
        width="52"
        height="70"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M80 61h20"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <circle cx="54" cy="48" r="5" fill="currentColor" />
      <circle cx="126" cy="48" r="5" fill="currentColor" />
      <path
        d="M46 70h16M118 70h16M46 82h22M118 82h22"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M78 111c10-14 14-14 24 0 10 14 14 14 24 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="90"
        cy="111"
        r="4"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="114"
        cy="111"
        r="4"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
