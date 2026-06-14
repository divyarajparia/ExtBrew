import { create } from "zustand";

interface PreviewStorageState {
  data: Record<string, unknown>;
  get: (keys: string | string[] | null) => Record<string, unknown>;
  set: (items: Record<string, unknown>) => void;
  remove: (keys: string | string[]) => void;
  clear: () => void;
}

export const usePreviewStorageStore = create<PreviewStorageState>((set, get) => ({
  data: {},

  get: (keys) => {
    const data = get().data;
    if (keys === null || keys === undefined) return { ...data };
    if (typeof keys === "string") {
      return keys in data ? { [keys]: data[keys] } : {};
    }
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in data) out[k] = data[k];
      }
      return out;
    }
    return {};
  },

  set: (items) => {
    set((s) => ({ data: { ...s.data, ...items } }));
  },

  remove: (keys) => {
    set((s) => {
      const next = { ...s.data };
      const arr = typeof keys === "string" ? [keys] : keys;
      for (const k of arr) delete next[k];
      return { data: next };
    });
  },

  clear: () => set({ data: {} }),
}));
