"use client";

import dynamic from "next/dynamic";

const DEFAULT_VALUE = `{
  "manifest_version": 3,
  "name": "Your extension will appear here",
  "version": "1.0.0",
  "description": "Describe what you want to build in the chat, and ExtBrew will scaffold it for you.",
  "permissions": [],
  "action": {
    "default_popup": "popup.html"
  }
}`;

// Monaco is browser-only. ssr:false means Next.js never attempts to render it
// on the server, so there's no hydration mismatch. The outer div maintains the
// layout while the editor JS loads.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export function EditorPane() {
  return (
    <div className="flex-1 overflow-hidden">
      <MonacoEditor
        height="100%"
        defaultLanguage="json"
        theme="vs"
        defaultValue={DEFAULT_VALUE}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "var(--font-mono), Menlo, monospace",
          lineNumbers: "on",
          readOnly: true,
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          automaticLayout: true,
          renderLineHighlight: "none",
          overviewRulerBorder: false,
        }}
      />
    </div>
  );
}
