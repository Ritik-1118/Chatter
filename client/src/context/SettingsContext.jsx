import { createContext, useCallback, useContext } from "react";
import { createPersistentStore, usePersistentStore } from "@/lib/persistentStore";

const DEFAULTS = { enterToSend: false, notifications: false, sounds: true };
const SettingsContext = createContext({ settings: DEFAULTS, updateSettings: () => {} });

const settingsStore = createPersistentStore("chatter.settings", DEFAULTS, {
    migrate: (saved) => {
        const next = { ...DEFAULTS, ...(saved || {}) };
        // Older builds stored this flag on its own.
        const legacy = typeof localStorage !== "undefined" ? localStorage.getItem("enterToSend") : null;
        if (legacy !== null && saved?.enterToSend === undefined) next.enterToSend = legacy === "true";
        return next;
    },
});

// Persisted per-browser preferences; every consumer re-renders when they change.
export function SettingsProvider({ children }) {
    const settings = usePersistentStore(settingsStore);
    const updateSettings = useCallback((patch) => settingsStore.set((prev) => ({ ...prev, ...patch })), []);
    return <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
