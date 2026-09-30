import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "../../server/node_modules/mongoose/index.js";
import { makeUser } from "../../server/test/helpers/harness.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const state = () => JSON.parse(fs.readFileSync(path.join(here, "..", ".build", "state.json"), "utf8"));

export async function api(user, method, urlPath, json) {
    const headers = { Authorization: `Bearer ${user.token}` };
    if (json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(state().apiUrl + urlPath, {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
    });
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, data: text };
    }
}

// Creates a fully onboarded user (Firebase identity + Mongo profile).
// Names get a random suffix because all tests share one database.
export async function createUser(base) {
    const name = `${base} ${Math.random().toString(36).slice(2, 6)}`;
    const user = makeUser(base);
    user.name = name;
    const res = await api(user, "POST", "/api/auth/onboard-user", { name, about: `${name}'s status`, image: "/avatars/2.png" });
    if (!res.data?.user?._id) throw new Error(`onboarding ${name} failed: ${JSON.stringify(res)}`);
    user.id = res.data.user._id;
    return user;
}

export async function sendViaApi(from, to, message) {
    const res = await api(from, "POST", "/api/messages/add-message", { from: from.id, to: to.id, message });
    return res.data.message;
}

export const oid = (id) => new mongoose.Types.ObjectId(id);

let conn;
export async function db() {
    if (!conn) conn = await mongoose.createConnection(state().mongoUri).asPromise();
    return conn.db;
}

const firebaseIdentity = (user) => ({
    uid: user.uid,
    email: user.email,
    displayName: user.name,
    photoURL: null,
});

// Opens a new browser context already signed in (Firebase-side) as `user`.
async function openAs(browser, user, { localStorage: extra = {}, pending = false } = {}) {
    const context = await browser.newContext();
    await context.addInitScript(
        ([key, identity, extraEntries]) => {
            if (!window.sessionStorage.getItem("__e2e_init")) {
                window.localStorage.setItem(key, JSON.stringify(identity));
                for (const [k, v] of Object.entries(extraEntries)) window.localStorage.setItem(k, v);
                window.sessionStorage.setItem("__e2e_init", "1");
            }
        },
        [pending ? "__e2e_pending_user" : "__e2e_user", firebaseIdentity(user), extra],
    );
    const page = await context.newPage();
    page.errors = [];
    page.on("pageerror", (err) => page.errors.push(err.message));
    // Next.js catches render/effect exceptions and only logs them, so record those too.
    page.on("console", (m) => {
        const text = m.text();
        // "Abort fetching component" is Next's notice for a superseded navigation (see B-C25).
        if (m.type() === "error" && /^(TypeError|ReferenceError|Error):/.test(text) && !/Abort fetching component/.test(text)) {
            page.errors.push(text.split("\n")[0]);
        }
    });
    return page;
}

export const test = base.extend({
    openAs: async ({ browser }, use) => {
        const pages = [];
        await use(async (user, opts) => {
            const page = await openAs(browser, user, opts);
            pages.push(page);
            return page;
        });
        for (const p of pages) await p.context().close();
    },
});

export { expect };

// ---- UI helpers (selectors reflect the current markup) ----
export const chatItem = (page, name) => page.getByRole("button", { name: `Open chat with ${name}` });
export const chatHeader = (page) => page.locator("div.h-16", { hasText: /(online|offline)/ }).first();

export async function openApp(page) {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Chat list" })).toBeVisible();
}

export async function openChat(page, name) {
    await chatItem(page, name).click();
    await expect(chatHeader(page)).toContainText(name);
}

export async function typeAndSend(page, text) {
    await page.locator("#message-box").fill(text);
    await page.getByRole("button", { name: "Send message" }).click();
}

export const bubbles = (page) => page.locator("div.custom-scrollbar span.break-all");

const iconByTitle = (page, title) => page.locator("svg", { has: page.locator("title", { hasText: title }) });
export const newChatIcon = (page) => iconByTitle(page, "New Chat");
export const menuIcon = (page) => iconByTitle(page, "Menu");

// B-C24: a real click on these icons lands on the inner <path> and the menu closes
// immediately. Flows that just need the menu open target the <svg> element itself.
export async function openMenu(locator) {
    const box = await locator.boundingBox();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true };
    await locator.dispatchEvent("click", at);
}
