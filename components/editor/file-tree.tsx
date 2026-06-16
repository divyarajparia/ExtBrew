"use client";

import { File, FileCode, FileCog, FileJson, FileText } from "lucide-react";
import { useFileSystemStore } from "@/lib/stores/file-system-store";

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["js", "jsx", "ts", "tsx"].includes(ext)) return <FileCode size={14} />;
  if (ext === "json") return <FileJson size={14} />;
  if (["html", "htm", "md"].includes(ext)) return <FileText size={14} />;
  if (ext === "css") return <FileCog size={14} />;
  return <File size={14} />;
}

export function FileTree() {
  const files = useFileSystemStore((s) => s.files);
  const openFile = useFileSystemStore((s) => s.openFile);
  const setOpenFile = useFileSystemStore((s) => s.setOpenFile);

  const paths = Object.keys(files).sort();

  return (
    <div className="flex h-full w-40 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Files
        </span>
      </div>
      {paths.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="px-3 text-center text-xs text-muted-foreground">
            Empty — ask ExtBrew to build something
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {paths.map((path) => (
            <button
              key={path}
              onClick={() => setOpenFile(path)}
              className={`flex h-7 w-full items-center gap-2 px-3 text-sm ${
                path === openFile
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {getFileIcon(path)}
              <span className="truncate">{path.split("/").pop() ?? path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
