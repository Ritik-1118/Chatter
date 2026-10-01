import { useSyncExternalStore } from "react";

// A tiny localStorage-backed store usable with useSyncExternalStore. The server
// snapshot is the default value, so hydration always matches.
export function createPersistentStore(key, defaults, { parse = JSON.parse, serialize = JSON.stringify, migrate } = {}) {
    const listeners = new Set();
    let cache;

    const read = () => {
        try {
            const raw = localStorage.getItem(key);
            const value = raw === null ? undefined : parse(raw);
            return migrate ? migrate(value) : value ?? defaults;
        } catch {
            return defaults;
        }
    };

    const store = {
        get() {
            if (cache === undefined) cache = read();
            return cache;
        },
        set(next) {
            cache = typeof next === "function" ? next(store.get()) : next;
            try {
                localStorage.setItem(key, serialize(cache));
            } catch {
                /* storage unavailable */
            }
            listeners.forEach((l) => l());
        },
        subscribe(listener) {
            listeners.add(listener);
            const onStorage = (e) => {
                if (e.key === key) {
                    cache = read();
                    listener();
                }
            };
            window.addEventListener("storage", onStorage);
            return () => {
                listeners.delete(listener);
                window.removeEventListener("storage", onStorage);
            };
        },
    };
    store.defaults = defaults;
    return store;
}

export function usePersistentStore(store) {
    return useSyncExternalStore(store.subscribe, store.get, () => store.defaults);
}
