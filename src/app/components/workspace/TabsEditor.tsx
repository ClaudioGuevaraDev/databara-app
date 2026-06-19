import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import { DATABARA_EDITOR_THEME, defineDatabaraTheme } from "../../editor/databaraTheme";
import { registerSqlCompletionProvider } from "../../editor/sqlCompletion";
import type { DatabaseObjectDetails } from "../../types";
import { useSqlEditor } from "../../workspace/workspaceCore";
import { EditorTabs } from "./EditorTabs";
import { EmptyEditor } from "./EmptyEditor";
import { QueryToolbar } from "./QueryToolbar";

export function TabsEditor() {
  const editor = useSqlEditor();
  const selectedObjectRef = useRef<DatabaseObjectDetails | null>(editor.completionObject);
  const runQueryRef = useRef(editor.runQuery);
  const saveActiveSqlTabRef = useRef(editor.saveActiveSqlTab);
  const completionProviderRef = useRef<ReturnType<
    Monaco["languages"]["registerCompletionItemProvider"]
  > | null>(null);

  useEffect(() => {
    selectedObjectRef.current = editor.completionObject;
  }, [editor.completionObject]);

  useEffect(() => {
    runQueryRef.current = editor.runQuery;
    saveActiveSqlTabRef.current = editor.saveActiveSqlTab;
  }, [editor.runQuery, editor.saveActiveSqlTab]);

  useEffect(() => {
    return () => {
      completionProviderRef.current?.dispose();
    };
  }, []);

  const handleEditorMount = useCallback<OnMount>((monacoEditor, monaco) => {
    completionProviderRef.current?.dispose();
    completionProviderRef.current = registerSqlCompletionProvider(monaco, () => ({
      selectedObject: selectedObjectRef.current,
    }));

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runQueryRef.current();
    });
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveActiveSqlTabRef.current();
    });
  }, []);

  return (
    <>
      <EditorTabs
        activeTabId={editor.activeTabId}
        onClose={editor.closeSqlTab}
        onSelect={editor.selectSqlTab}
        tabs={editor.sqlTabs}
      />
      <QueryToolbar
        canSave={Boolean(
          editor.activeTab && (editor.activeTab.state === "temporary" || editor.activeTab.dirty),
        )}
        isRunning={editor.isRunning}
        onRun={editor.runQuery}
        onSave={() => void editor.saveActiveSqlTab()}
      />
      <section className="min-h-0 flex-1 bg-background">
        {editor.activeTab ? (
          <Editor
            key={editor.activeTab.id}
            defaultLanguage="sql"
            loading={<div className="h-full w-full bg-background" />}
            value={editor.activeTab.sql}
            theme={DATABARA_EDITOR_THEME}
            beforeMount={defineDatabaraTheme}
            onChange={(value) => editor.updateActiveSql(value ?? "")}
            onMount={handleEditorMount}
            options={{
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              contextmenu: false,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
              fontLigatures: true,
              fontSize: 13,
              glyphMargin: false,
              guides: { bracketPairs: "active", indentation: true },
              lineHeight: 21,
              lineNumbersMinChars: 3,
              minimap: { enabled: false },
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              padding: { bottom: 18, top: 18 },
              renderLineHighlight: "all",
              roundedSelection: true,
              scrollBeyondLastLine: false,
              scrollbar: {
                horizontalScrollbarSize: 14,
                useShadows: false,
                verticalScrollbarSize: 14,
              },
              smoothScrolling: true,
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
