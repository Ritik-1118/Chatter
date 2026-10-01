// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPersistentStore } from "@/lib/persistentStore";

describe("createPersistentStore", () => {
    beforeEach(() => localStorage.clear());

    it("[B-C17][B-C18] persists values and notifies subscribers immediately", () => {
        const store = createPersistentStore("k1", { enterToSend: false });
        const seen = [];
        const unsubscribe = store.subscribe(() => seen.push(store.get()));
        store.set((prev) => ({ ...prev, enterToSend: true }));
        expect(seen).toEqual([{ enterToSend: true }]);
        expect(JSON.parse(localStorage.getItem("k1"))).toEqual({ enterToSend: true });
        unsubscribe();
        // A new store instance (e.g. after reload) reads the saved value.
        expect(createPersistentStore("k1", { enterToSend: false }).get()).toEqual({ enterToSend: true });
    });

    it("falls back to defaults on corrupt data", () => {
        localStorage.setItem("k2", "{not json");
        expect(createPersistentStore("k2", { a: 1 }).get()).toEqual({ a: 1 });
    });
});
