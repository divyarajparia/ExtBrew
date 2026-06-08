import { create } from "zustand";
import { inferLanguage } from "@/lib/utils/infer-language";

interface FileEntry {
  content: string;
  language: string;
}

interface FileSystemState {
  files: Record<string, FileEntry>;
  openFile: string | null;
  createFile: (path: string, content: string) => void;
  editFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  setOpenFile: (path: string | null) => void;
  clearFiles: () => void;
}

export const useFileSystemStore = create<FileSystemState>()((set) => ({
  files: {},
  openFile: null,
  createFile: (path, content) =>
    set((s) => ({
      files: { ...s.files, [path]: { content, language: inferLanguage(path) } },
    })),
  editFile: (path, content) =>
    set((s) => ({
      files: { ...s.files, [path]: { content, language: inferLanguage(path) } },
    })),
  deleteFile: (path) =>
    set((s) => {
      const files = { ...s.files };
      delete files[path];
      return { files, openFile: s.openFile === path ? null : s.openFile };
    }),
  setOpenFile: (path) => set({ openFile: path }),
  clearFiles: () => set({ files: {}, openFile: null }),
}));

// if (typeof window !== "undefined") { (window as any).__fs = useFileSystemStore; }
