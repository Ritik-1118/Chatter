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
    const res = await fetch(state().apiUrl + urlPath, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, data: text };
    }
}

// Creates a fully onboarded user (Firebase identity + profile).
// Names get a random suffix because all tests share one database.
export async function createUser(baseName) {
    const name = `${baseName} ${Math.random().toString(36).slice(2, 6)}`;
    const user = makeUser(baseName);
    user.name = name;
    const res = await api(user, "POST", "/api/auth/onboard-user", { name, about: `${name}'s status`, image: "/avatars/2.png" });
    if (!res.data?.user?.id) throw new Error(`onboarding ${name} failed: ${JSON.stringify(res)}`);
    user.id = res.data.user.id;
    return user;
}

export async function sendViaApi(from, to, message) {
    const res = await api(from, "POST", "/api/messages/add-message", { to: to.id, message });
    if (res.status !== 201) throw new Error(`send failed: ${JSON.stringify(res)}`);
    return res.data.message;
}

export async function createGroup(owner, name, members) {
    const res = await api(owner, "POST", "/api/conversations", { name, participantIds: members.map((m) => m.id) });
    return res.data.conversation;
}

export const oid = (id) => new mongoose.Types.ObjectId(id);

let conn;
export async function db() {
    if (!conn) conn = await mongoose.createConnection(state().mongoUri).asPromise();
    return conn.db;
}

const firebaseIdentity = (user) => ({ uid: user.uid, email: user.email, displayName: user.name, photoURL: null });

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

// ---- UI helpers ----
export const chatList = (page) => page.getByRole("navigation", { name: "Chat list" });
export const chatItem = (page, name) => page.getByRole("button", { name: `Open chat with ${name}`, exact: true });
export const chatHeader = (page) => page.locator('header[aria-label="Chat header"]');
export const chatStatus = (page) => page.getByTestId("chat-status");
export const bubbles = (page) => page.getByTestId("message-text");
// The bubble whose own text is exactly `text` (not one that merely quotes it in a reply).
export const bubble = (page, text) => page.getByTestId("message-bubble").filter({ has: page.getByTestId("message-text").getByText(text, { exact: true }) });
export const messageLog = (page) => page.getByRole("log", { name: "Messages" });
export const composer = (page) => page.getByRole("textbox", { name: "Message input" });

export async function openApp(page) {
    await page.goto("/");
    await expect(chatList(page)).toBeVisible();
    await expect(page.getByLabel("Loading chats")).toHaveCount(0);
}

export async function openChat(page, name) {
    await chatList(page)
        .getByRole("button", { name: `Open chat with ${name}`, exact: true })
        .click();
    await expect(chatHeader(page)).toContainText(name);
}

export async function typeAndSend(page, text) {
    await composer(page).fill(text);
    await page.getByRole("button", { name: "Send message" }).click();
}

export async function messageAction(page, text, action) {
    const target = bubble(page, text);
    await target.hover();
    await target.getByRole("button", { name: "Message actions" }).click();
    await page.getByRole("menuitem", { name: action, exact: true }).click();
}
