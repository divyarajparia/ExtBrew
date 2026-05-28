import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ApiKeyState {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (key) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: null }),
    }),
    {
      name: "extbrew:anthropic_api_key",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);

/**
 * SSR-safe hook that returns true only after Zustand has rehydrated from
 * localStorage on the client. Always returns false on the server so the
 * initial server render and client hydration match (no hydration mismatch).
 *
 * Why not store hasHydrated in Zustand state: the onRehydrateStorage callback
 * runs synchronously during store creation, before the `const useApiKeyStore`
 * binding is assigned (TDZ), so any setState call inside it silently fails.
 */
export function useHasHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useApiKeyStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useApiKeyStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
