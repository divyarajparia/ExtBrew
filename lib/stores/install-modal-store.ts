import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type OpenSource = "auto" | "manual" | null;

interface InstallModalState {
  open: boolean;
  openSource: OpenSource;
  dontShowAgain: boolean;
  setOpen: (open: boolean) => void;
  openManually: () => void;
  openIfNotDismissed: () => void;
  setDontShowAgain: (val: boolean) => void;
}

export const useInstallModalStore = create<InstallModalState>()(
  persist(
    (set, get) => ({
      open: false,
      openSource: null,
      dontShowAgain: false,
      setOpen: (open) =>
        set({ open, openSource: open ? get().openSource : null }),
      openManually: () => set({ open: true, openSource: "manual" }),
      openIfNotDismissed: () => {
        if (!get().dontShowAgain) set({ open: true, openSource: "auto" });
      },
      setDontShowAgain: (val) => set({ dontShowAgain: val }),
    }),
    {
      name: "extbrew:install_modal_dismissed",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ dontShowAgain: s.dontShowAgain }),
    }
  )
);