import { expect } from "chai";
import { io as ioc } from "socket.io-client";
import { collect, delay, startServer, waitFor } from "../helpers/harness.js";

const post = (server, from, to, message) =>
    server.request("POST", "/api/messages/add-message", {
        user: from,
        json: { from: from.id, to: to.id, message },
    });

// Mirrors MessageBar.sendMessage: persist over HTTP, then relay over the socket.
async function clientSend(server, socket, from, to, text) {
    const { data } = await post(server, from, to, text);
    const confirmed = { ...data.message, messageStatus: "sent" };
    socket.emit("send-msg", { to: to.id, from: from.id, message: confirmed, tempId: `temp-${Date.now()}` });
    return confirmed;
}

describe("Real-time messaging (Socket.IO)", () => {
    let server;
    const sockets = [];
    const track = (s) => {
        sockets.push(s);
        return s;
    };

    before(async () => {
        server = await startServer();
    });
    afterEach(async () => {
        while (sockets.length) sockets.pop().close();
        await delay(150);
    });
    after(async () => {
        await server.stop();
    });

    describe("handshake", () => {
        it("rejects a connection without a token", async () => {
            const s = ioc(server.baseUrl, { transports: ["websocket"], reconnection: false, forceNew: true });
            const err = await new Promise((resolve) => s.once("connect_error", resolve));
            s.close();
            expect(err.message).to.equal("unauthorized");
        });

        it("rejects a connection with an invalid token", async () => {
            const s = ioc(server.baseUrl, {
                auth: { token: "garbage" },
                transports: ["websocket"],
                reconnection: false,
                forceNew: true,
            });
            const err = await new Promise((resolve) => s.once("connect_error", resolve));
            s.close();
            expect(err.message).to.equal("unauthorized");
        });
    });

    describe("presence", () => {
        it("broadcasts the online list to other users when someone comes online", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            const update = waitFor(bobSocket, "online-users");
            track(await server.connect(alice));
            const { onlineUsers } = await update;
            expect(onlineUsers).to.include(alice.id);
        });

        it("broadcasts the online list when someone disconnects", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            const aliceSocket = await server.connect(alice);
            const update = waitFor(bobSocket, "online-users");
            aliceSocket.close();
            const { onlineUsers } = await update;
            expect(onlineUsers).to.not.include(alice.id);
        });

        it("[B-S28] sends the current online list to the user who just (re)connected", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            track(await server.connect(bob));
            const aliceSocket = track(await server.connect(alice, { addUser: false }));
            const update = waitFor(aliceSocket, "online-users");
            aliceSocket.emit("add-user", alice.id);
            const { onlineUsers } = await update;
            expect(onlineUsers).to.include(bob.id);
        });

        it("[B-S29] keeps a user online while another tab/device is still connected", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            track(await server.connect(alice)); // tab 1 stays open
            const tab2 = await server.connect(alice);
            const offline = collect(bobSocket, "user-offline", 600);
            tab2.close(); // closing the most recently opened tab
            expect(await offline).to.have.length(0);
            const list = waitFor(bobSocket, "online-users");
            bobSocket.emit("add-user");
            expect((await list).onlineUsers).to.include(alice.id);
        });

        it("[B-S29] delivers messages to every open tab of the recipient", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const aliceSocket = track(await server.connect(alice));
            const bobTab1 = track(await server.connect(bob));
            const bobTab2 = track(await server.connect(bob));
            const r1 = waitFor(bobTab1, "msg-recieve");
            const r2 = waitFor(bobTab2, "msg-recieve");
            await clientSend(server, aliceSocket, alice, bob, "to all tabs");
            await Promise.all([r1, r2]);
        });

        it("[B-S02] ignores `signout` for a user id other than the socket's own", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const mallory = await server.createUser("Mallory");
            const bobSocket = track(await server.connect(bob));
            track(await server.connect(alice));
            const malSocket = track(await server.connect(mallory));
            await delay(100);
            const updates = collect(bobSocket, "online-users", 500);
            malSocket.emit("signout", alice.id);
            const seen = await updates;
            const last = seen.at(-1)?.onlineUsers ?? [alice.id];
            expect(last).to.include(alice.id);
        });
    });

    describe("message relay", () => {
        it("relays a message to an online recipient and acks the sender", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const aliceSocket = track(await server.connect(alice));
            const bobSocket = track(await server.connect(bob));
            const received = waitFor(bobSocket, "msg-recieve");
            const ack = waitFor(aliceSocket, "msg-ack");
            const sent = await clientSend(server, aliceSocket, alice, bob, "hi bob");
            const got = await received;
            expect(got.from).to.equal(alice.id);
            expect(got.message._id).to.equal(sent._id);
            expect((await ack).message._id).to.equal(sent._id);
        });

        it("[B-S03] does not report 'delivered' when the recipient is offline", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob"); // never connects
            const aliceSocket = track(await server.connect(alice));
            const delivered = collect(aliceSocket, "delivered", 700);
            await clientSend(server, aliceSocket, alice, bob, "are you there?");
            expect(await delivered).to.have.length(0);
        });

        it("[B-S03] persists 'delivered' when the recipient comes online later", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const aliceSocket = track(await server.connect(alice));
            const sent = await clientSend(server, aliceSocket, alice, bob, "later");
            await delay(500); // let any premature "delivered" event arrive and be ignored
            const deliveredEvt = waitFor(aliceSocket, "delivered", 2000);
            track(await server.connect(bob));
            const { messageId } = await deliveredEvt;
            expect(messageId).to.equal(sent._id);
        });

        it("[B-S01] does not relay a message whose `from` differs from the authenticated socket", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const mallory = await server.createUser("Mallory");
            const bobSocket = track(await server.connect(bob));
            const malSocket = track(await server.connect(mallory));
            const got = collect(bobSocket, "msg-recieve", 700);
            malSocket.emit("send-msg", {
                from: alice.id,
                to: bob.id,
                message: { _id: "fake", sender: alice.id, receiver: bob.id, message: "wire me $500", type: "text" },
            });
            expect(await got).to.have.length(0);
        });

        it("[B-S01] relays only messages that exist in the database", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            const aliceSocket = track(await server.connect(alice));
            const got = collect(bobSocket, "msg-recieve", 700);
            aliceSocket.emit("send-msg", {
                from: alice.id,
                to: bob.id,
                message: { _id: "never-saved", sender: alice.id, receiver: bob.id, message: "ghost", type: "text" },
            });
            expect(await got).to.have.length(0);
        });

        it("[B-S01] does not let one user register as another user's id (add-user hijack)", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const mallory = await server.createUser("Mallory");
            track(await server.connect(bob));
            const aliceSocket = track(await server.connect(alice));
            const malSocket = track(await server.connect(mallory));
            malSocket.emit("add-user", bob.id); // claim to be Bob
            await delay(100);
            const stolen = collect(malSocket, "msg-recieve", 700);
            await clientSend(server, aliceSocket, alice, bob, "private for bob");
            expect(await stolen).to.have.length(0);
        });
    });

    describe("read receipts", () => {
        it("[B-S04] notifies the sender when the recipient reads (as emitted by ChatContainer.jsx)", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const aliceSocket = track(await server.connect(alice));
            const bobSocket = track(await server.connect(bob));
            const incoming = waitFor(bobSocket, "msg-recieve");
            const sent = await clientSend(server, aliceSocket, alice, bob, "read me");
            await incoming;
            const readEvt = waitFor(aliceSocket, "read", 1500);
            // Exactly what ChatContainer emits: from = the reader, to = chat partner.
            bobSocket.emit("read-message", { messageIds: [sent._id], from: bob.id, to: alice.id });
            const { messageIds } = await readEvt;
            expect(messageIds).to.deep.equal([sent._id]);
        });

        it("[B-S04] does not let a third party mark someone else's messages as read", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const mallory = await server.createUser("Mallory");
            const malSocket = track(await server.connect(mallory));
            const { data } = await post(server, alice, bob, "not for mallory");
            malSocket.emit("read-message", { messageIds: [data.message._id], from: alice.id, to: bob.id });
            await delay(300);
            const convo = await server.request("GET", `/api/messages/get-initial-contacts/${alice.id}`, { user: alice });
            const entry = convo.data.users.find((u) => u.name === "Bob");
            expect(entry.messageStatus).to.not.equal("read");
        });
    });

    describe("robustness against malformed events", () => {
        // Each case gets a fresh server because a failing case kills the process.
        const cases = [
            ["read-message with no payload", (s) => s.emit("read-message")],
            ["read-message with a malformed id", (s) => s.emit("read-message", { messageIds: ["zzz"], from: "x" })],
            ["outgoing-voice-call with no payload", (s) => s.emit("outgoing-voice-call")],
            ["accept-incoming-call with no payload", (s) => s.emit("accept-incoming-call")],
            ["send-msg with a non-object message", (s) => s.emit("send-msg", { to: 1, from: 2, message: 5 })],
        ];
        for (const [name, fire] of cases) {
            it(`[B-S30] survives ${name}`, async () => {
                const local = await startServer();
                try {
                    const user = await local.createUser("Fuzz");
                    const s = await local.connect(user);
                    fire(s);
                    await delay(500);
                    s.close();
                    expect(local.isAlive(), `server crashed:\n${local.logs.slice(-5).join("")}`).to.equal(true);
                    const res = await local.request("POST", "/api/auth/check-user", { user });
                    expect(res.status).to.equal(200);
                } finally {
                    await local.stop();
                }
            });
        }
    });
});

describe("Call signalling (Socket.IO)", () => {
    let server;
    const sockets = [];
    const track = (s) => {
        sockets.push(s);
        return s;
    };
    before(async () => {
        server = await startServer();
    });
    afterEach(async () => {
        while (sockets.length) sockets.pop().close();
        await delay(150);
    });
    after(async () => {
        await server.stop();
    });

    it("rings the callee, relays accept to the caller and reject back to the caller", async () => {
        const alice = await server.createUser("Alice");
        const bob = await server.createUser("Bob");
        const aliceSocket = track(await server.connect(alice));
        const bobSocket = track(await server.connect(bob));

        const ring = waitFor(bobSocket, "incoming-video-call");
        aliceSocket.emit("outgoing-video-call", {
            to: bob.id,
            from: { id: alice.id, name: "Alice", profilePicture: "/avatars/1.png" },
            callType: "video",
            roomId: 42,
        });
        const incoming = await ring;
        expect(incoming.from.id).to.equal(alice.id);
        expect(incoming.roomId).to.equal(42);

        const accepted = waitFor(aliceSocket, "accept-call");
        bobSocket.emit("accept-incoming-call", { id: alice.id });
        await accepted;

        const rejected = waitFor(aliceSocket, "video-call-rejected");
        bobSocket.emit("reject-video-call", { from: alice.id });
        await rejected;
    });

    it("[B-C01] reaches the callee using the payload the client builds from the open chat", async () => {
        const alice = await server.createUser("Alice");
        const bob = await server.createUser("Bob");
        const aliceSocket = track(await server.connect(alice));
        const bobSocket = track(await server.connect(bob));
        // Mirrors ChatHeader: the call target is the open chat's partner id.
        const currentChat = { id: "conversation-id", partnerId: bob.id, name: "Bob", profilePicture: "/avatars/2.png" };
        const videoCall = { ...currentChat, id: currentChat.partnerId, type: "out-going", callType: "video", roomId: Date.now() };
        const ring = waitFor(bobSocket, "incoming-video-call", 1000);
        aliceSocket.emit("outgoing-video-call", {
            to: videoCall.id,
            from: { id: alice.id, profilePicture: "/avatars/1.png", name: "Alice" },
            callType: videoCall.callType,
            roomId: videoCall.roomId,
        });
        await ring;
    });

    it("[G-04] tells the caller immediately when the callee is offline", async () => {
        const alice = await server.createUser("Alice");
        const bob = await server.createUser("Bob"); // offline
        const aliceSocket = track(await server.connect(alice));
        const events = collect(aliceSocket, "call-unavailable", 800);
        aliceSocket.emit("outgoing-voice-call", {
            to: bob.id,
            from: { id: alice.id, name: "Alice" },
            callType: "voice",
            roomId: 7,
        });
        expect(await events).to.have.length(1);
    });

    it("[G-04] stops ringing on the callee side when the caller hangs up before answer", async () => {
        const alice = await server.createUser("Alice");
        const bob = await server.createUser("Bob");
        const aliceSocket = track(await server.connect(alice));
        const bobSocket = track(await server.connect(bob));
        const ring = waitFor(bobSocket, "incoming-voice-call");
        aliceSocket.emit("outgoing-voice-call", { to: bob.id, from: { id: alice.id }, callType: "voice", roomId: 9 });
        await ring;
        // Container.endCall on the caller side emits reject-voice-call with `from: data.id`,
        // which is undefined for an outgoing call built from currentChatUser.
        const cancelled = collect(bobSocket, "voice-call-rejected", 800);
        aliceSocket.emit("reject-voice-call", { from: undefined });
        expect(await cancelled).to.have.length(1);
    });
});
