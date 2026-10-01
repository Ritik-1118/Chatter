import {
    api,
    bubble,
    bubbles,
    chatHeader,
    chatItem,
    chatStatus,
    composer,
    createUser,
    db,
    expect,
    messageAction,
    oid,
    openApp,
    openChat,
    sendViaApi,
    test,
    typeAndSend,
} from "./fixtures.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const addLatency = (page, pattern, ms) =>
    page.route(pattern, async (route) => {
        await new Promise((r) => setTimeout(r, ms));
        await route.continue();
    });

async function pair(openAs, { seed = true } = {}) {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    if (seed) await sendViaApi(alice, bob, "seed");
    const a = await openAs(alice);
    const b = await openAs(bob);
    await openApp(a);
    await openApp(b);
    return { alice, bob, a, b };
}

test.describe("Messaging", () => {
    test("two users exchange messages in real time in an open chat", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
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
        const { alice, bob, a, b } = await pair(openAs, { seed: false });
        await a.getByRole("button", { name: "New chat" }).click();
        await chatItem(a, bob.name).click();
        await typeAndSend(a, "hello stranger");
        await expect(bubbles(a).filter({ hasText: "hello stranger" })).toBeVisible();
        await expect(chatItem(b, alice.name)).toBeVisible();
        await expect(chatItem(b, alice.name).getByLabel("1 unread")).toBeVisible();
    });

    test("[B-C05] the chat-list entry created after a first message opens the right conversation", async ({ openAs }) => {
        const { bob, a } = await pair(openAs, { seed: false });
        await a.getByRole("button", { name: "New chat" }).click();
        await chatItem(a, bob.name).click();
        await typeAndSend(a, "first contact");
        await expect(bubbles(a).filter({ hasText: "first contact" })).toBeVisible();
        await a.getByRole("button", { name: "Chat menu" }).click();
        await a.getByRole("menuitem", { name: "Close chat" }).click();
        await openChat(a, bob.name);
        await expect(bubbles(a).filter({ hasText: "first contact" })).toBeVisible();
    });

    test("[B-S04] the sender sees 'read' ticks once the recipient has the chat open", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await typeAndSend(a, "did you read this?");
        await expect(bubbles(b).filter({ hasText: "did you read this?" })).toBeVisible();
        await expect(bubble(a, "did you read this?").getByRole("img", { name: "Read" })).toBeVisible();
    });

    test("[B-S03] a message to an offline user shows a single 'Sent' tick, then 'Delivered' once they connect", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "seed");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await typeAndSend(a, "are you there?");
        await expect(bubble(a, "are you there?").getByRole("img", { name: "Sent" })).toBeVisible();
        const b = await openAs(bob);
        await openApp(b);
        await expect(bubble(a, "are you there?").getByRole("img", { name: "Delivered" })).toBeVisible();
    });

    test("regression guard: the recipient acknowledges each message as read once, not on every render", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice);
        const b = await openAs(bob);
        const frames = [];
        b.on("websocket", (ws) => ws.on("framesent", (f) => typeof f.payload === "string" && f.payload.includes('"read-message"') && frames.push(f.payload)));
        await openApp(a);
        await openApp(b);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        for (const text of ["one", "two", "three"]) {
            await typeAndSend(a, text);
            await expect(bubbles(b).filter({ hasText: text })).toBeVisible();
        }
        await b.waitForTimeout(500);
        expect(frames.length).toBeGreaterThan(0);
        const ids = frames.flatMap((p) => JSON.parse(p.slice(p.indexOf("[")))[1].messageIds);
        expect(ids.length).toBe(new Set(ids).size);
    });

    test("[B-C20] pressing Enter twice on a slow network does not send the message twice", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "seed");
        const a = await openAs(alice, { localStorage: { "chatter.settings": JSON.stringify({ enterToSend: true }) } });
        await addLatency(a, /\/messages$/, 400);
        await openApp(a);
        await openChat(a, bob.name);
        const text = `only once ${Date.now()}`;
        await composer(a).fill(text);
        await composer(a).press("Enter");
        await composer(a).press("Enter");
        await expect(bubble(a, text).getByRole("img", { name: "Sent" })).toBeVisible();
        expect(await (await db()).collection("messages").countDocuments({ message: text })).toBe(1);
        await expect(bubbles(a).filter({ hasText: text })).toHaveCount(1);
    });

    test("[B-C18] toggling 'Send on Enter' in Settings takes effect without a reload", async ({ openAs }) => {
        const { bob, a } = await pair(openAs);
        await openChat(a, bob.name);
        await a.getByRole("button", { name: "Settings", exact: true }).click();
        await a.getByRole("switch", { name: "Send on Enter" }).click();
        await a.getByRole("button", { name: "Close settings modal" }).click();
        await composer(a).fill("sent with enter");
        await composer(a).press("Enter");
        await expect(bubbles(a).filter({ hasText: "sent with enter" })).toBeVisible();
    });

    test("[B-C16] in-chat message search is case-insensitive and jumps to the result", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(bob, alice, "Hello World");
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await a.getByRole("button", { name: "Search messages" }).click();
        await a.getByRole("searchbox", { name: "Search messages" }).fill("hello");
        await expect(a.getByText("No messages found.")).toHaveCount(0);
        await a.getByRole("list", { name: "Search results" }).getByRole("button").first().click();
        await expect(a.getByTestId("message-bubble").filter({ hasText: "Hello World" })).toHaveClass(/ring-2/);
    });

    test("[B-C23][B-C19] voice note: record, send, the recorder closes and the file keeps its real format", async ({ openAs }) => {
        const { alice, bob, a } = await pair(openAs);
        await openChat(a, bob.name);
        await a.getByRole("button", { name: "Record audio message" }).click();
        await expect(a.getByText(/Recording/)).toBeVisible();
        await a.waitForTimeout(1500);
        await a.getByRole("button", { name: "Stop recording" }).click();
        await a.getByRole("button", { name: "Send voice message" }).click();
        await expect(composer(a)).toBeVisible();
        await expect(a.getByRole("button", { name: "Play voice message" })).toBeVisible();
        await expect
            .poll(async () => (await (await db()).collection("messages").findOne({ type: "audio", sender: oid(alice.id) }))?.message)
            .toMatch(/\.(webm|ogg|m4a)$/);
    });

    test("[G-05] typing indicator shows while the other person types", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await composer(a).pressSequentially("hel", { delay: 50 });
        await expect(chatStatus(b)).toHaveText("typing…");
        await a.getByRole("button", { name: "Send message" }).click();
        await expect(chatStatus(b)).toHaveText("online");
    });

    test("[G-07] reply, react, edit and delete for everyone, live on both sides", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await typeAndSend(a, "original text");
        await expect(bubbles(b).filter({ hasText: "original text" })).toBeVisible();

        await messageAction(b, "original text", "Reply");
        await expect(b.getByText("Replying", { exact: true })).toBeVisible();
        await typeAndSend(b, "my reply");
        await expect(bubble(a, "my reply").getByRole("button").filter({ hasText: "original text" })).toBeVisible();

        await messageAction(b, "original text", "React");
        await b.getByRole("menuitem", { name: "👍" }).click();
        await expect(bubble(a, "original text").getByRole("button", { name: /^👍 1/ })).toBeVisible();

        await messageAction(a, "original text", "Edit");
        await composer(a).fill("edited text");
        await a.getByRole("button", { name: "Save edit" }).click();
        await expect(bubbles(b).filter({ hasText: "edited text" })).toBeVisible();
        await expect(bubble(b, "edited text")).toContainText("edited");

        a.once("dialog", (d) => d.accept());
        await messageAction(a, "edited text", "Delete for everyone");
        await expect(b.getByText("This message was deleted").first()).toBeVisible();
    });

    test("images and documents are delivered and viewable by the recipient", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await a.getByTestId("image-input").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
        const img = b.getByRole("button", { name: "Open image" }).locator("img");
        await expect(img).toBeVisible();
        await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

        const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
        await a.getByTestId("file-input").setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: pdf });
        const link = b.getByRole("link", { name: "Download report.pdf" });
        await expect(link).toBeVisible();
        const res = await b.request.get(await link.getAttribute("href"));
        expect(res.status()).toBe(200);
    });

    test("links in messages are clickable and open safely", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await typeAndSend(a, "see https://example.com/page please");
        const link = b
            .getByTestId("message-text")
            .filter({ hasText: "see https://example.com/page please" })
            .getByRole("link", { name: "https://example.com/page" });
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
    });

    test("[G-03] long histories load page by page", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        for (let i = 1; i <= 60; i++) await sendViaApi(bob, alice, `history ${i}`);
        const a = await openAs(alice);
        await openApp(a);
        await openChat(a, bob.name);
        await expect(bubbles(a).filter({ hasText: /^history 60$/ })).toBeVisible();
        await expect(bubbles(a)).toHaveCount(50);
        await a.getByRole("button", { name: "Load older messages" }).click();
        await expect(bubbles(a)).toHaveCount(60);
        await expect(bubbles(a).filter({ hasText: /^history 1$/ })).toBeAttached();
    });

    test("[G-12] shows a reconnecting banner and recovers after the network drops", async ({ openAs }) => {
        const { alice, bob, a, b } = await pair(openAs);
        await openChat(a, bob.name);
        await openChat(b, alice.name);
        await b.context().setOffline(true);
        await expect(b.getByText(/Reconnecting|offline/)).toBeVisible({ timeout: 15000 });
        await b.context().setOffline(false);
        await expect(b.getByText(/Reconnecting|offline/)).toHaveCount(0, { timeout: 20000 });
        await typeAndSend(a, "after reconnect");
        await expect(bubbles(b).filter({ hasText: "after reconnect" })).toBeVisible();
    });

    test("[G-06] background messages raise a browser notification when enabled", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const carol = await createUser("Carol");
        await sendViaApi(alice, bob, "seed");
        const b = await openAs(bob, { localStorage: { "chatter.settings": JSON.stringify({ notifications: true }) } });
        await b.addInitScript(() => {
            window.__notifications = [];
            window.Notification = class {
                static permission = "granted";
                static requestPermission = async () => "granted";
                constructor(title, opts) {
                    window.__notifications.push({ title, body: opts?.body });
                }
                close() {}
            };
        });
        await openApp(b);
        await openChat(b, alice.name); // Carol's chat is in the background
        await sendViaApi(carol, bob, "psst");
        await expect.poll(() => b.evaluate(() => window.__notifications)).toEqual([{ title: carol.name, body: "psst" }]);
    });

    test("blocking a contact disables messaging both ways until unblocked", async ({ openAs }) => {
        const { alice, bob, a } = await pair(openAs);
        await openChat(a, bob.name);
        await a.getByRole("button", { name: "Chat menu" }).click();
        await a.getByRole("menuitem", { name: "Block" }).click();
        await expect(a.getByText("You blocked this contact.")).toBeVisible();
        await expect(composer(a)).toHaveCount(0);
        expect((await api(bob, "POST", "/api/messages/add-message", { to: alice.id, message: "hey" })).status).toBe(403);
        await a.getByRole("button", { name: "Unblock" }).click();
        await expect(composer(a)).toBeVisible();
        await expect(chatHeader(a).getByRole("button", { name: "Voice call" })).toBeEnabled();
    });
});
