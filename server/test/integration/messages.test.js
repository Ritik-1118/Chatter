import { expect } from "chai";
import { delay, startServer, waitFor } from "../helpers/harness.js";

const send = (server, from, to, message) =>
    server.request("POST", "/api/messages/add-message", {
        user: from,
        json: { from: from.id, to: to.id ?? to, message },
    });

describe("Messages API (/api/messages)", () => {
    let server;
    let alice;
    let bob;
    let carol;

    before(async () => {
        server = await startServer();
        alice = await server.createUser("Alice");
        bob = await server.createUser("Bob");
        carol = await server.createUser("Carol");
    });
    after(async () => {
        await server.stop();
    });

    describe("add-message", () => {
        it("persists a text message and returns it with 201", async () => {
            const res = await send(server, alice, bob, "hello bob");
            expect(res.status).to.equal(201);
            expect(res.data.message).to.include({ message: "hello bob", type: "text" });
            expect(res.data.message.sender).to.equal(alice.id);
            expect(res.data.message.receiver).to.equal(bob.id);
        });

        it("marks the message 'sent' when the recipient is offline", async () => {
            const res = await send(server, alice, carol, "carol is offline");
            expect(res.data.message.messageStatus).to.equal("sent");
        });

        it("marks the message 'delivered' when the recipient is online", async () => {
            const bobSocket = await server.connect(bob);
            try {
                const res = await send(server, alice, bob, "bob is online");
                expect(res.data.message.messageStatus).to.equal("delivered");
            } finally {
                bobSocket.close();
                await delay(100);
            }
        });

        it("rejects a spoofed sender with 403", async () => {
            const res = await server.request("POST", "/api/messages/add-message", {
                user: alice,
                json: { from: bob.id, to: carol.id, message: "pretending to be bob" },
            });
            expect(res.status).to.equal(403);
        });

        it("returns 404 for a well-formed but unknown receiver id", async () => {
            const res = await send(server, alice, "0123456789abcdef01234567", "nobody");
            expect(res.status).to.equal(404);
        });

        it("[B-S18] returns 400 (not 500) for a malformed receiver id", async () => {
            const res = await send(server, alice, "not-an-object-id", "bad id");
            expect(res.status).to.equal(400);
        });

        it("[B-S19] rejects whitespace-only and oversized messages", async () => {
            const blank = await send(server, alice, bob, "   \n  ");
            expect(blank.status).to.equal(400);
            const huge = await send(server, alice, bob, "x".repeat(20000));
            expect(huge.status).to.equal(400);
        });

        it("[B-S20] rejects non-string message payloads", async () => {
            const res = await server.request("POST", "/api/messages/add-message", {
                user: alice,
                json: { from: alice.id, to: bob.id, message: { $ne: null } },
            });
            expect(res.status).to.equal(400);
        });
    });

    describe("get-messages", () => {
        let dave;
        let erin;
        before(async () => {
            dave = await server.createUser("Dave");
            erin = await server.createUser("Erin");
            await send(server, dave, erin, "m1");
            await send(server, erin, dave, "m2");
            await send(server, dave, erin, "m3");
        });

        it("returns the conversation in chronological order", async () => {
            const res = await server.request("GET", `/api/messages/get-messages/${erin.id}/${dave.id}`, { user: erin });
            expect(res.status).to.equal(200);
            expect(res.data.messages.map((m) => m.message)).to.deep.equal(["m1", "m2", "m3"]);
        });

        it("marks the reader's incoming messages as read", async () => {
            const res = await server.request("GET", `/api/messages/get-messages/${dave.id}/${erin.id}`, { user: dave });
            const incoming = res.data.messages.filter((m) => m.sender === erin.id);
            expect(incoming.every((m) => m.messageStatus === "read")).to.equal(true);
        });

        it("forbids reading another user's conversation", async () => {
            const res = await server.request("GET", `/api/messages/get-messages/${dave.id}/${erin.id}`, { user: carol });
            expect(res.status).to.equal(403);
        });

        it("[B-S18] returns 400 (not 500) for a malformed partner id", async () => {
            const res = await server.request("GET", `/api/messages/get-messages/${dave.id}/zzz`, { user: dave });
            expect(res.status).to.equal(400);
        });

        it("[B-S06] notifies the original sender in real time when history fetch marks messages read", async () => {
            const frank = await server.createUser("Frank");
            const gina = await server.createUser("Gina");
            await send(server, frank, gina, "read me");
            const frankSocket = await server.connect(frank);
            try {
                const readEvent = waitFor(frankSocket, "read", 1500);
                // Gina opens the chat: the client only calls get-messages.
                await server.request("GET", `/api/messages/get-messages/${gina.id}/${frank.id}`, { user: gina });
                const data = await readEvent;
                expect(data.messageIds).to.have.length(1);
            } finally {
                frankSocket.close();
            }
        });

        it("[G-03] supports cursor pagination (limit/before) for long histories", async () => {
            const res = await server.request(
                "GET",
                `/api/messages/get-messages/${dave.id}/${erin.id}?limit=2`,
                { user: dave },
            );
            expect(res.data.messages).to.have.length(2);
            expect(res.data.messages.map((m) => m.message)).to.deep.equal(["m2", "m3"]);
        });
    });

    describe("get-initial-contacts (chat list)", () => {
        let hank;
        let ivy;
        let jack;
        before(async () => {
            hank = await server.createUser("Hank");
            ivy = await server.createUser("Ivy");
            jack = await server.createUser("Jack");
            await send(server, ivy, hank, "ivy-1");
            await send(server, ivy, hank, "ivy-2");
            await send(server, hank, jack, "hank-to-jack");
        });

        it("lists one entry per conversation partner with the latest message and unread count", async () => {
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            expect(res.status).to.equal(200);
            const byName = Object.fromEntries(res.data.users.map((u) => [u.name, u]));
            expect(Object.keys(byName).sort()).to.deep.equal(["Ivy", "Jack"]);
            expect(byName.Ivy.message).to.equal("ivy-2");
            expect(byName.Ivy.totalUnreadMessages).to.equal(2);
            expect(byName.Jack.totalUnreadMessages).to.equal(0);
        });

        it("forbids reading another user's chat list", async () => {
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: ivy });
            expect(res.status).to.equal(403);
        });

        it("[B-S07] reports the last message time, not the contact's account creation time", async () => {
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            const ivyEntry = res.data.users.find((u) => u.name === "Ivy");
            const history = await server.request("GET", `/api/messages/get-messages/${hank.id}/${ivy.id}`, { user: hank });
            const last = history.data.messages.at(-1);
            expect(ivyEntry.createdAt).to.equal(last.createdAt);
        });

        it("[B-S08] does not leak the contact's full sent/received message id arrays", async () => {
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            const ivyEntry = res.data.users.find((u) => u.name === "Ivy");
            expect(ivyEntry).to.not.have.property("sentMessages");
            expect(ivyEntry).to.not.have.property("receivedMessages");
        });

        it("[B-S09] does not flip the caller's *own* outgoing messages to 'delivered'", async () => {
            // Jack has never come online; Hank merely loading his chat list must not
            // mark Hank's message to Jack as delivered.
            await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            const jackEntry = res.data.users.find((u) => u.name === "Jack");
            expect(jackEntry.messageStatus).to.equal("sent");
        });

        it("[B-S21] identifies the partner by an explicit field rather than overloaded _id", async () => {
            const res = await server.request("GET", `/api/messages/get-initial-contacts/${hank.id}`, { user: hank });
            const ivyEntry = res.data.users.find((u) => u.name === "Ivy");
            // `_id` is the partner's user id (spread from the populated user), while the
            // message id lives under `messageId`. The client has to reverse-engineer this.
            expect(ivyEntry).to.have.property("partnerId", ivy.id);
        });
    });
});
