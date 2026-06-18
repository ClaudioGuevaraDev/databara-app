import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import { registerSqlCompletionProvider } from "../../editor/sqlCompletion";
import type { DatabaseObjectDetails } from "../../types";
import { useSqlEditor } from "../../workspace/workspaceCore";
import { EditorTabs } from "./EditorTabs";
import { EmptyEditor } from "./EmptyEditor";
import { QueryToolbar } from "./QueryToolbar";

export function TabsEditor() {
  const editor = useSqlEditor();
  const selectedObjectRef = useRef<DatabaseObjectDetails | null>(editor.selectedObject);
  const saveActiveSqlTab = editor.saveActiveSqlTab;
  const completionProviderRef = useRef<ReturnType<
    Monaco["languages"]["registerCompletionItemProvider"]
  > | null>(null);

  useEffect(() => {
    selectedObjectRef.current = editor.selectedObject;
  }, [editor.selectedObject]);

  useEffect(() => {
    return () => {
      completionProviderRef.current?.dispose();
    };
  }, []);

  const handleEditorMount = useCallback<OnMount>(
    (monacoEditor, monaco) => {
      selectedObjectRef.current = editor.selectedObject;
      completionProviderRef.current?.dispose();
      completionProviderRef.current = registerSqlCompletionProvider(monaco, () => ({
        selectedObject: selectedObjectRef.current,
      }));

      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void saveActiveSqlTab();
      });
    },
    [editor.selectedObject, saveActiveSqlTab],
  );

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
        onRun={editor.runQuery}
        onSave={() => void editor.saveActiveSqlTab()}
      />
      <section className="min-h-0 flex-1 bg-[hsl(220_13%_8%)]">
        {editor.activeTab ? (
          <Editor
            key={editor.activeTab.id}
            defaultLanguage="sql"
            loading={<div className="h-full w-full bg-[hsl(220_13%_8%)]" />}
            value={editor.activeTab.sql}
            theme="vs-dark"
            onChange={(value) => editor.updateActiveSql(value ?? "")}
            onMount={handleEditorMount}
            options={{
              automaticLayout: true,
              contextmenu: false,
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
