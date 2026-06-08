"use client";

import dynamic from "next/dynamic";
import { FolderOpen } from "lucide-react";
import { FileTree } from "@/components/editor/file-tree";
import { useFileSystemStore } from "@/lib/stores/file-system-store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export function EditorPane() {
  const files = useFileSystemStore((s) => s.files);
  const openFile = useFileSystemStore((s) => s.openFile);

  return (
    <div className="flex h-full overflow-hidden">
      <FileTree />
      <div className="flex flex-1 flex-col overflow-hidden">
        {openFile === null || !files[openFile] ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <FolderOpen size={32} className="text-muted-foreground" />
            <p className="text-base font-medium">No files yet</p>
            <p className="text-sm text-muted-foreground">
              Chat with Claude to build your first Chrome extension.
            </p>
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            path={openFile}
            language={files[openFile].language}
            value={files[openFile].content}
            theme="vs"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "var(--font-mono), Menlo, monospace",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              automaticLayout: true,
              renderLineHighlight: "none",
              overviewRulerBorder: false,
            }}
          />
        )}
      </div>
    </div>
  );
}
