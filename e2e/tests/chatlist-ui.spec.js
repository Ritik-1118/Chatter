import {
    chatHeader,
    chatItem,
    createUser,
    db,
    expect,
    newChatIcon,
    oid,
    openApp,
    openChat,
    sendViaApi,
    test,
} from "./fixtures.js";

const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
const ddmmyyyy = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

async function backdate(message, date) {
    await (await db()).collection("messages").updateOne({ _id: oid(message._id) }, { $set: { createdAt: date } });
}

test.describe("Chat list & UI", () => {
    test("[B-S07] a chat shows the date of its last message", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const carol = await createUser("Carol");
        const old = await sendViaApi(carol, alice, "old from carol");
        const oldDate = new Date(Date.now() - TEN_DAYS);
        await backdate(old, oldDate);

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
        // Carol's conversation is from today; it must not show Bob's 10-day-old date.
        await expect(chatItem(page, carol.name)).not.toContainText(ddmmyyyy(oldDate));
    });

    test("[B-C08] unread badge is visibly styled", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "one");
        await sendViaApi(bob, alice, "two");
        const page = await openAs(alice);
        await openApp(page);
        const badge = chatItem(page, bob.name).locator("span.rounded-full", { hasText: "2" });
        await expect(badge).toBeVisible();
        const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    });

    test("[B-C13] searching contacts with no match shows no chats", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "hi");
        const page = await openAs(alice);
        await openApp(page);
        await expect(chatItem(page, bob.name)).toBeVisible();
        await page.getByPlaceholder("Search to start a new chat!").fill("zzzz-no-such-person");
        await expect(chatItem(page, bob.name)).toHaveCount(0);
    });

    test("[B-S14] the New Chat contact picker does not offer yourself", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const page = await openAs(alice);
        await openApp(page);
        await newChatIcon(page).click();
        await expect(chatItem(page, bob.name)).toBeVisible();
        await expect(chatItem(page, alice.name)).toHaveCount(0);
    });

    test("[B-C17] the chosen theme survives a reload", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        const toggle = page.getByRole("button", { name: "Toggle theme" });
        await expect(toggle).toHaveAttribute("title", "Switch to light mode");
        await toggle.click();
        await expect(toggle).toHaveAttribute("title", "Switch to dark mode");
        await page.reload();
        await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("title", "Switch to dark mode");
    });

    test("[B-C22] using the photo menu in the Profile panel does not crash", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        await page.locator("div.cursor-pointer", { has: page.locator("span", { hasText: /^Profile$/ }) }).click();
        const panel = page.locator("div.pointer-events-auto", { has: page.getByRole("button", { name: "Close profile modal" }) });
        await panel.getByAltText("Avatar").hover();
        await panel.getByText("Change profile photo").click();
        await page.getByText("Remove photo").click();
        await page.waitForTimeout(300);
        expect(page.errors).toEqual([]);
    });

    test("[B-C26] the Profile panel shows a returning user's About text", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        await page.locator("div.cursor-pointer", { has: page.locator("span", { hasText: /^Profile$/ }) }).click();
        await expect(page.getByRole("button", { name: "Close profile modal" })).toBeVisible();
        await expect(page.getByText(`${alice.name}'s status`)).toBeVisible();
    });

    test("[B-C07] list items have stable, unique React keys", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const carol = await createUser("Carol");
        await sendViaApi(bob, alice, "hi");
        await sendViaApi(carol, alice, "hey");
        const page = await openAs(alice);
        await openApp(page);
        await expect(chatItem(page, carol.name)).toBeVisible();
        // Component names are minified in production, so find chat-list items by their props.
        const keys = await page.evaluate(() => {
            const btn = document.querySelector("button[aria-label^='Open chat with']");
            const fiberKey = Object.keys(btn).find((k) => k.startsWith("__reactFiber"));
            let f = btn[fiberKey];
            while (f && !(f.memoizedProps && f.memoizedProps.data && typeof f.type === "function")) f = f.return;
            const parent = f.return;
            const out = [];
            for (let c = parent.child; c; c = c.sibling) out.push(c.key);
            return out;
        });
        expect(keys.length).toBeGreaterThan(1);
        expect(keys).not.toContain(null);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

test.describe("Calls", () => {
    test("[B-C01] starting a video call rings the other user", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await chatHeader(a).locator("svg").nth(1).click(); // video icon
        await expect(a.getByText("Calling")).toBeVisible(); // caller is on the call screen
        await expect(b.getByText("Incoming video call")).toBeVisible();
    });

    test("[B-C02] the call screen requests a call token from the API", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        const tokenReq = a.waitForRequest(/generate-token/, { timeout: 5000 }).catch(() => null);
        await chatHeader(a).locator("svg").nth(0).click(); // voice icon
        await expect(a.getByText("Calling")).toBeVisible();
        const req = await tokenReq;
        expect(req?.url() ?? "no token request", "token URL").toMatch(/\/api\/auth\/generate-token\/[0-9a-f]{24}$/);
    });
});
