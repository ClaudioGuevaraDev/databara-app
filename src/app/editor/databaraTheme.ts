import type { Monaco } from "@monaco-editor/react";

export const DATABARA_EDITOR_THEME = "databara-dark";
export const DATABARA_EDITOR_THEME_LIGHT = "databara-light";

let defined = false;

/**
 * Defines the Databara Monaco themes: a deep-navy dark canvas and a clean
 * near-white light canvas, both with a cyan-led SQL palette that mirrors the
 * app's design tokens (see src/styles/globals.css), replacing the generic
 * built-in "vs-dark"/"vs" looks. Idempotent. Pick the theme name to apply with
 * `resolveEditorTheme(isDark)`.
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

  monaco.editor.defineTheme(DATABARA_EDITOR_THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "1f2a37" },
      { token: "keyword", foreground: "0b8fa1", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "0b8fa1", fontStyle: "bold" },
      { token: "operator", foreground: "5b6b7a" },
      { token: "operator.sql", foreground: "5b6b7a" },
      { token: "delimiter", foreground: "5b6b7a" },
      { token: "delimiter.sql", foreground: "5b6b7a" },
      { token: "string", foreground: "1f8a54" },
      { token: "string.sql", foreground: "1f8a54" },
      { token: "number", foreground: "a2661f" },
      { token: "number.sql", foreground: "a2661f" },
      { token: "comment", foreground: "8a97a6", fontStyle: "italic" },
      { token: "comment.sql", foreground: "8a97a6", fontStyle: "italic" },
      { token: "predefined", foreground: "2f6fb0" },
      { token: "predefined.sql", foreground: "2f6fb0" },
      { token: "type", foreground: "1f8a9a" },
      { token: "type.sql", foreground: "1f8a9a" },
      { token: "identifier", foreground: "1f2a37" },
    ],
    colors: {
      "editor.background": "#fbfcfd",
      "editor.foreground": "#1f2a37",
      "editorCursor.foreground": "#0b8fa1",
      "editor.lineHighlightBackground": "#eef2f6",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#0b8fa133",
      "editor.inactiveSelectionBackground": "#0b8fa11f",
      "editor.selectionHighlightBackground": "#0b8fa122",
      "editorLineNumber.foreground": "#aab4c0",
      "editorLineNumber.activeForeground": "#0b8fa1",
      "editorIndentGuide.background1": "#e2e8f0",
      "editorIndentGuide.activeBackground1": "#c7d0dc",
      "editorBracketMatch.background": "#0b8fa122",
      "editorBracketMatch.border": "#0b8fa155",
      "editorBracketHighlight.foreground1": "#0b8fa1",
      "editorBracketHighlight.foreground2": "#a2661f",
      "editorBracketHighlight.foreground3": "#1f8a54",
      "editorGutter.background": "#fbfcfd",
      "editorWhitespace.foreground": "#dbe2ea",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e2e8f0",
      "editorHoverWidget.background": "#ffffff",
      "editorHoverWidget.border": "#e2e8f0",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#e2e8f0",
      "editorSuggestWidget.foreground": "#1f2a37",
      "editorSuggestWidget.selectedForeground": "#0f1720",
      "editorSuggestWidget.selectedBackground": "#0b8fa11f",
      "editorSuggestWidget.focusHighlightForeground": "#0b8fa1",
      "editorSuggestWidget.highlightForeground": "#0b8fa1",
      "symbolIcon.keywordForeground": "#0b8fa1",
      "symbolIcon.functionForeground": "#2f6fb0",
      "symbolIcon.typeParameterForeground": "#1f8a9a",
      "symbolIcon.structForeground": "#a2661f",
      "symbolIcon.fieldForeground": "#1f8a54",
      "symbolIcon.snippetForeground": "#5b6b7a",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#5b6b7a2e",
      "scrollbarSlider.hoverBackground": "#0e9bb0c6",
      "scrollbarSlider.activeBackground": "#0e9bb0",
    },
  });

  defined = true;
}

/** Resolves the Monaco theme name for the current effective app theme. */
export function resolveEditorTheme(isDark: boolean): string {
  return isDark ? DATABARA_EDITOR_THEME : DATABARA_EDITOR_THEME_LIGHT;
}
