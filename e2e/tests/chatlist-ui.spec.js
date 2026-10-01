import AxeBuilder from "@axe-core/playwright";
import { bubbles, chatHeader, chatItem, createGroup, createUser, db, expect, messageLog, oid, openApp, openChat, sendViaApi, test, typeAndSend } from "./fixtures.js";

const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
const ddmmyyyy = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

async function backdate(message, date) {
    const conn = await db();
    await conn.collection("messages").updateOne({ _id: oid(message._id) }, { $set: { createdAt: date } });
    await conn.collection("conversations").updateOne({ _id: oid(message.conversationId) }, { $set: { lastMessageAt: date } });
}

test.describe("Chat list & UI", () => {
    test("[B-S07] a chat shows the date of its last message", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const carol = await createUser("Carol");
        const oldDate = new Date(Date.now() - TEN_DAYS);
        await backdate(await sendViaApi(carol, alice, "old from carol"), oldDate);
        const page = await openAs(alice);
        await openApp(page);
        await expect(chatItem(page, carol.name)).toContainText(ddmmyyyy(oldDate));
    });

    test("[B-C04] opening one chat does not change the timestamps shown for other chats", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const carol = await createUser("Carol");
        const oldDate = new Date(Date.now() - TEN_DAYS);
        await backdate(await sendViaApi(bob, alice, "old from bob"), oldDate);
        await sendViaApi(carol, alice, "fresh from carol");
        const page = await openAs(alice);
        await openApp(page);
        await openChat(page, bob.name);
        await expect(chatItem(page, carol.name)).not.toContainText(ddmmyyyy(oldDate));
        await expect(chatItem(page, bob.name)).toContainText(ddmmyyyy(oldDate));
    });

    test("[B-C08] unread badge and read ticks are visibly styled", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "one");
        await sendViaApi(bob, alice, "two");
        const page = await openAs(alice);
        await openApp(page);
        const badge = chatItem(page, bob.name).getByLabel("2 unread");
        await expect(badge).toBeVisible();
        expect(await badge.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(37, 211, 102)");
    });

    test("[B-C13] searching chats with no match shows an empty state", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "hi");
        const page = await openAs(alice);
        await openApp(page);
        await page.getByRole("searchbox", { name: "Search chats" }).fill("zzzz-no-such-person");
        await expect(chatItem(page, bob.name)).toHaveCount(0);
        await expect(page.getByText("No chats match your search.")).toBeVisible();
        await page.getByRole("searchbox", { name: "Search chats" }).fill(bob.name.slice(0, 3).toLowerCase());
        await expect(chatItem(page, bob.name)).toBeVisible();
    });

    test("[B-S14] the New chat picker does not offer yourself", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const page = await openAs(alice);
        await openApp(page);
        await page.getByRole("button", { name: "New chat" }).click();
        await page.getByRole("searchbox", { name: "Search contacts" }).fill(bob.name);
        await expect(chatItem(page, bob.name)).toBeVisible();
        await page.getByRole("searchbox", { name: "Search contacts" }).fill(alice.name);
        await expect(page.getByText("No contacts found.")).toBeVisible();
    });

    test("[B-C17] the chosen theme survives a reload", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        const html = page.locator("html");
        // Starts from the OS preference, then the user's explicit choice wins and persists.
        const startedDark = /dark/.test((await html.getAttribute("class")) || "");
        await page.getByRole("button", { name: "Toggle theme" }).click();
        await expect(html).toHaveClass(startedDark ? /^(?!.*dark)/ : /dark/);
        await page.reload();
        await expect(html).toHaveClass(startedDark ? /^(?!.*dark)/ : /dark/);
        await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("title", startedDark ? "Switch to dark mode" : "Switch to light mode");
    });

    test("[B-C07] chat list items have stable, unique React keys", async ({ openAs }) => {
        const alice = await createUser("Alice");
        await sendViaApi(await createUser("Bob"), alice, "hi");
        await sendViaApi(await createUser("Carol"), alice, "hey");
        const page = await openAs(alice);
        await openApp(page);
        const keys = await page.evaluate(() => {
            const items = [...document.querySelectorAll("ul[aria-label='Conversations'] > li")];
            return items.map((li) => li[Object.keys(li).find((k) => k.startsWith("__reactFiber"))]?.key ?? null);
        });
        expect(keys.length).toBe(2);
        expect(keys).not.toContain(null);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

test.describe("Groups", () => {
    test("[G-08] create a group from the UI; members see it and chat live", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const carol = await createUser("Carol");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);

        await a.getByRole("button", { name: "New group", exact: true }).first().click();
        for (const u of [bob, carol]) {
            await a.getByRole("searchbox", { name: "Search people to add" }).fill(u.name);
            await a.getByRole("checkbox", { name: `Add ${u.name}` }).check();
        }
        await a.getByRole("button", { name: /^Next \(2 selected\)$/ }).click();
        await a.getByLabel("Group name").fill("Weekend plans");
        await a.getByRole("button", { name: "Create group" }).click();
        await expect(chatHeader(a)).toContainText("Weekend plans");
        await expect(messageLog(a).getByText(/created the group "Weekend plans"/)).toBeVisible();

        await expect(chatItem(b, "Weekend plans")).toBeVisible();
        await openChat(b, "Weekend plans");
        await typeAndSend(a, "who's in?");
        await expect(bubbles(b).filter({ hasText: "who's in?" })).toBeVisible();
        await expect(b.getByTestId("message-bubble").filter({ hasText: "who's in?" })).toContainText(alice.name);
    });

    test("admins manage members from Group info; removed members lose the chat", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const carol = await createUser("Carol");
        await createGroup(alice, "Book club", [bob, carol]);
        const a = await openAs(alice);
        const c = await openAs(carol);
        await openApp(a);
        await openApp(c);
        await expect(chatItem(c, "Book club")).toBeVisible();

        await openChat(a, "Book club");
        await chatHeader(a).getByRole("button", { name: "Group info for Book club" }).click();
        const members = a.getByRole("region", { name: "Members" });
        await expect(members.getByRole("listitem")).toHaveCount(3);
        a.once("dialog", (d) => d.accept());
        await members.getByRole("listitem").filter({ hasText: carol.name }).getByRole("button", { name: "Remove" }).click();
        await expect(members.getByRole("listitem")).toHaveCount(2);
        await expect(chatItem(c, "Book club")).toHaveCount(0);
    });
});

test.describe("Calls", () => {
    test("[B-C01][B-C31] a video call rings the other user; declining ends it for the caller", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await chatHeader(a).getByRole("button", { name: "Video call" }).click();
        await expect(a.getByRole("main", { name: `Video call with ${bob.name}` })).toContainText("Calling…");
        const ringing = b.getByRole("alertdialog", { name: `Incoming video call from ${alice.name}` });
        await expect(ringing).toBeVisible();
        await ringing.getByRole("button", { name: "Decline" }).click();
        await expect(a.getByText("Call declined")).toBeVisible();
        await expect(a.getByRole("main", { name: `Video call with ${bob.name}` })).toHaveCount(0);
        // The call is logged in the chat for both sides.
        await openChat(b, alice.name);
        await expect(messageLog(b).getByText("Declined video call")).toBeVisible();
    });

    test("[B-C02][B-S05] accepting fetches the caller's own call token from the API", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        const tokenResponse = a.waitForResponse(/\/api\/auth\/generate-token$/);
        await chatHeader(a).getByRole("button", { name: "Voice call" }).click();
        await b.getByRole("alertdialog").getByRole("button", { name: "Accept" }).click();
        const res = await tokenResponse;
        expect(res.status()).toBe(200);
        expect((await res.json()).token).toMatch(/^04/);
    });

    test("[G-04] calling an offline user tells the caller right away", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob"); // never opens the app
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await chatHeader(a).getByRole("button", { name: "Voice call" }).click();
        await expect(a.getByText("They're offline right now")).toBeVisible();
        await expect(a.getByRole("main", { name: /Voice call with/ })).toHaveCount(0);
    });
});

test.describe("Accessibility", () => {
    for (const [name, open] of [
        ["login page", async (page) => page.goto("/login")],
        ["chat view", null],
    ]) {
        test(`[B-C36] ${name} has no serious or critical axe violations`, async ({ openAs, page: anon }) => {
            let page = anon;
            if (open) await open(page);
            else {
                const alice = await createUser("Alice");
                const bob = await createUser("Bob");
                await sendViaApi(bob, alice, "hello there");
                page = await openAs(alice);
                await openApp(page);
                await openChat(page, bob.name);
            }
            const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
            const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
            expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
            const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id));
            expect(ids.length).toBe(new Set(ids).size);
        });
    }
});
