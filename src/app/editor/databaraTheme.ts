import type { Monaco } from "@monaco-editor/react";

export const DATABARA_EDITOR_THEME = "databara-dark";

let defined = false;

/**
 * Defines the Databara Monaco theme: deep-navy canvas with a cyan-led SQL
 * palette that mirrors the app's design tokens (see src/styles/globals.css),
 * replacing the generic built-in "vs-dark" look. Idempotent.
 */
export function defineDatabaraTheme(monaco: Monaco) {
  if (defined) return;

  monaco.editor.defineTheme(DATABARA_EDITOR_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "d3dbe6" },
      { token: "keyword", foreground: "2dd6e0", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "2dd6e0", fontStyle: "bold" },
      { token: "operator", foreground: "8a97a6" },
      { token: "operator.sql", foreground: "8a97a6" },
      { token: "delimiter", foreground: "8a97a6" },
      { token: "delimiter.sql", foreground: "8a97a6" },
      { token: "string", foreground: "87c8a4" },
      { token: "string.sql", foreground: "87c8a4" },
      { token: "number", foreground: "c9a26b" },
      { token: "number.sql", foreground: "c9a26b" },
      { token: "comment", foreground: "54627a", fontStyle: "italic" },
      { token: "comment.sql", foreground: "54627a", fontStyle: "italic" },
      { token: "predefined", foreground: "7fb0e0" },
      { token: "predefined.sql", foreground: "7fb0e0" },
      { token: "type", foreground: "5fb8c4" },
      { token: "type.sql", foreground: "5fb8c4" },
      { token: "identifier", foreground: "d3dbe6" },
    ],
    colors: {
      "editor.background": "#0b0e13",
      "editor.foreground": "#d3dbe6",
      "editorCursor.foreground": "#2dd6e0",
      "editor.lineHighlightBackground": "#131922",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#2dd6e033",
      "editor.inactiveSelectionBackground": "#2dd6e01f",
      "editor.selectionHighlightBackground": "#2dd6e022",
      "editorLineNumber.foreground": "#3a4658",
      "editorLineNumber.activeForeground": "#2dd6e0",
      "editorIndentGuide.background1": "#1c2430",
      "editorIndentGuide.activeBackground1": "#2c3a4a",
      "editorBracketMatch.background": "#2dd6e022",
      "editorBracketMatch.border": "#2dd6e055",
      "editorBracketHighlight.foreground1": "#2dd6e0",
      "editorBracketHighlight.foreground2": "#e0b341",
      "editorBracketHighlight.foreground3": "#87c8a4",
      "editorGutter.background": "#0b0e13",
      "editorWhitespace.foreground": "#1c2430",
      "editorWidget.background": "#0f141d",
      "editorWidget.border": "#1f2937",
      "editorHoverWidget.background": "#0f141d",
      "editorHoverWidget.border": "#1f2937",
      "editorSuggestWidget.background": "#0f141d",
      "editorSuggestWidget.border": "#1f2937",
      "editorSuggestWidget.foreground": "#d3dbe6",
      "editorSuggestWidget.selectedForeground": "#eaf1f8",
      "editorSuggestWidget.selectedBackground": "#2dd6e01f",
      "editorSuggestWidget.focusHighlightForeground": "#2dd6e0",
      "editorSuggestWidget.highlightForeground": "#2dd6e0",
      "symbolIcon.keywordForeground": "#2dd6e0",
      "symbolIcon.functionForeground": "#7fb0e0",
      "symbolIcon.typeParameterForeground": "#5fb8c4",
      "symbolIcon.structForeground": "#e0b341",
      "symbolIcon.fieldForeground": "#87c8a4",
      "symbolIcon.snippetForeground": "#8a97a6",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#d3dbe624",
      "scrollbarSlider.hoverBackground": "#2dd6e0c6",
      "scrollbarSlider.activeBackground": "#2dd6e0",
    },
  });

  defined = true;
}
