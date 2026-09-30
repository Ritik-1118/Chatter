import {
    bubbles,
    chatHeader,
    chatItem,
    createUser,
    db,
    expect,
    newChatIcon,
    oid,
    openApp,
    openChat,
    openMenu,
    sendViaApi,
    test,
    typeAndSend,
} from "./fixtures.js";

// Emulates a real network round-trip for the add-message call.
const addLatency = (page, ms) =>
    page.route(/add-message/, async (route) => {
        await new Promise((r) => setTimeout(r, ms));
        await route.continue();
    });

async function startChatFromContacts(page, name) {
    await newChatIcon(page).click();
    await chatItem(page, name).click();
    await expect(chatHeader(page)).toContainText(name);
}

test.describe("Messaging", () => {
    test("two users exchange messages in real time in an open chat", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");

        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await openChat(b, alice.name);

        await typeAndSend(a, "ping from alice");
        await expect(bubbles(b).filter({ hasText: "ping from alice" })).toBeVisible();
        await typeAndSend(b, "pong from bob");
        await expect(bubbles(a).filter({ hasText: "pong from bob" })).toBeVisible();
        expect(a.errors).toEqual([]);
        expect(b.errors).toEqual([]);
    });

    test("[B-C10] a first message from a new contact appears in the recipient's chat list live", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const b = await openAs(bob);
        await openApp(b);

        const a = await openAs(alice);
        await openApp(a);
        await startChatFromContacts(a, bob.name);
        await typeAndSend(a, "hello stranger");
        await expect(bubbles(a).filter({ hasText: "hello stranger" })).toBeVisible();

        // Bob never reloads: the conversation should appear on its own.
        await expect(chatItem(b, alice.name)).toBeVisible();
    });

    test("[B-C05] the chat-list entry created after a first message opens the right conversation", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const a = await openAs(alice);
        await openApp(a);
        await startChatFromContacts(a, bob.name);
        await typeAndSend(a, "first contact");
        await expect(bubbles(a).filter({ hasText: "first contact" })).toBeVisible();

        // Leave the chat, then reopen it from the chat-list entry MessageBar inserted.
        await openMenu(chatHeader(a).locator("#context-opener"));
        await a.getByText("Exit", { exact: true }).click();
        await chatItem(a, bob.name).click();
        await expect(chatHeader(a)).toContainText(bob.name);
        await expect(bubbles(a).filter({ hasText: "first contact" })).toBeVisible();
    });

    test("[B-S04] the sender sees 'read' ticks once the recipient has the chat open", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await openChat(b, alice.name);

        await typeAndSend(a, "did you read this?");
        await expect(bubbles(b).filter({ hasText: "did you read this?" })).toBeVisible();
        const bubble = a.locator("div.custom-scrollbar div.rounded-md", { hasText: "did you read this?" });
        // MessageStatus renders the read state with the `text-icon-ack` class.
        await expect(bubble.locator("svg.text-icon-ack")).toHaveCount(1);
    });

    test("regression guard: the recipient acknowledges each message as read once, not on every render", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        const readFrames = [];
        b.on("websocket", (ws) =>
            ws.on("framesent", (f) => {
                if (typeof f.payload === "string" && f.payload.includes('"read-message"')) readFrames.push(f.payload);
            }),
        );
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        for (const text of ["one", "two", "three"]) {
            await typeAndSend(a, text);
            await expect(bubbles(b).filter({ hasText: text })).toBeVisible();
        }
        await b.waitForTimeout(500);
        expect(readFrames.length, "no read-message frames captured").toBeGreaterThan(0);
        const ids = readFrames.flatMap((p) => JSON.parse(p.slice(p.indexOf("[")))[1].messageIds);
        expect(ids.length, `read-message frames: ${readFrames.length}`).toBe(new Set(ids).size);
    });

    test("[B-C20] pressing Enter twice on a slow network does not send the message twice", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice, { localStorage: { enterToSend: "true" } });
        await addLatency(a, 400);
        await openApp(a);
        await openChat(a, bob.name);
        const text = `only once ${Date.now()}`;
        await a.locator("#message-box").fill(text);
        await a.locator("#message-box").press("Enter");
        await a.locator("#message-box").press("Enter");
        await a.waitForTimeout(2000);
        const count = await (await db()).collection("messages").countDocuments({ message: text });
        expect(count).toBe(1);
    });

    test("[B-C18] toggling 'Send on Enter' in Settings takes effect without a reload", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);

        await a.locator("div.cursor-pointer", { has: a.locator("span", { hasText: /^Setting$/ }) }).click();
        await a.locator("label", { has: a.locator("input[type=checkbox]") }).nth(3).click(); // Send on Enter
        await a.getByRole("button", { name: "Close settings modal" }).click();

        await a.locator("#message-box").fill("sent with enter");
        await a.locator("#message-box").press("Enter");
        await expect(bubbles(a).filter({ hasText: "sent with enter" })).toBeVisible();
    });

    test("[B-C16] in-chat message search is case-insensitive", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "Hello World");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await chatHeader(a).locator("svg").nth(2).click(); // search icon
        await a.getByPlaceholder("Search Messages").fill("hello");
        await expect(a.getByText("No messages found.")).toHaveCount(0);
    });

    test("[B-C23] voice note: record, send, and the recorder closes", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await a.getByRole("button", { name: "Record audio message" }).click();
        await expect(a.getByText(/Recording/)).toBeVisible();
        await a.waitForTimeout(1500);
        await a.locator("svg.text-red-500").last().click(); // stop
        await a.waitForTimeout(500);
        await a.locator("svg", { has: a.locator("title", { hasText: "Send" }) }).click();
        await a.waitForTimeout(1000);
        const saved = await (await db())
            .collection("messages")
            .findOne({ type: "audio", sender: oid(alice.id) });
        expect(saved, "voice note was not stored").toBeTruthy();
        await expect(a.locator("#message-box")).toBeVisible(); // recorder replaced by the text input again
    });
});
