import { expect } from "chai";
import { collect, delay, startServer, waitFor } from "../helpers/harness.js";

const json = (server, user, method, path, body) => server.request(method, path, { user, json: body });

describe("Conversations, groups and message features", () => {
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
        await delay(100);
    });
    after(async () => {
        await server.stop();
    });

    describe("direct conversations", () => {
        it("creates (idempotently) a direct conversation and posts to it by id", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const a = await json(server, alice, "POST", "/api/conversations/direct", { userId: bob.id });
            const b = await json(server, bob, "POST", "/api/conversations/direct", { userId: alice.id });
            expect(a.status).to.equal(200);
            expect(a.data.conversation.id).to.equal(b.data.conversation.id);
            expect(a.data.conversation.partnerId).to.equal(bob.id);

            const sent = await json(server, alice, "POST", `/api/conversations/${a.data.conversation.id}/messages`, { message: "hi", tempId: "t1" });
            expect(sent.status).to.equal(201);
            expect(sent.data.message).to.include({ message: "hi", tempId: "t1", conversationId: a.data.conversation.id });

            const list = await json(server, bob, "GET", "/api/conversations");
            expect(list.data.conversations.map((c) => c.id)).to.include(a.data.conversation.id);
        });

        it("refuses a direct chat with yourself", async () => {
            const alice = await server.createUser("Alice");
            const res = await json(server, alice, "POST", "/api/conversations/direct", { userId: alice.id });
            expect(res.status).to.equal(403);
        });

        it("pages backwards through history with `before`", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const { data } = await json(server, alice, "POST", "/api/conversations/direct", { userId: bob.id });
            const id = data.conversation.id;
            for (const n of [1, 2, 3, 4, 5]) await json(server, alice, "POST", `/api/conversations/${id}/messages`, { message: `m${n}` });
            const page1 = await json(server, bob, "GET", `/api/conversations/${id}/messages?limit=2`);
            expect(page1.data.messages.map((m) => m.message)).to.deep.equal(["m4", "m5"]);
            expect(page1.data.hasMore).to.equal(true);
            const page2 = await json(server, bob, "GET", `/api/conversations/${id}/messages?limit=2&before=${page1.data.nextCursor}`);
            expect(page2.data.messages.map((m) => m.message)).to.deep.equal(["m2", "m3"]);
        });
    });

    describe("groups", () => {
        it("creates a group, fans messages out to every member and tracks read state", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const carol = await server.createUser("Carol");
            const bobSocket = track(await server.connect(bob));
            const carolSocket = track(await server.connect(carol));
            const aliceSocket = track(await server.connect(alice));

            const created = await json(server, alice, "POST", "/api/conversations", { name: "Trip", participantIds: [bob.id, carol.id] });
            expect(created.status).to.equal(201);
            const group = created.data.conversation;
            expect(group).to.include({ isGroup: true, name: "Trip" });
            expect(group.participants.map((p) => p.id)).to.have.members([alice.id, bob.id, carol.id]);
            expect(group.admins).to.deep.equal([alice.id]);

            const toBob = waitFor(bobSocket, "msg-recieve");
            const toCarol = waitFor(carolSocket, "msg-recieve");
            const sent = await json(server, alice, "POST", `/api/conversations/${group.id}/messages`, { message: "hello team" });
            await Promise.all([toBob, toCarol]);
            expect(sent.data.message.messageStatus).to.equal("delivered");

            // Read by one member only: not yet "read" for the sender.
            const partial = collect(aliceSocket, "read", 500);
            bobSocket.emit("read-message", { messageIds: [sent.data.message._id] });
            expect(await partial).to.have.length(0);
            const full = waitFor(aliceSocket, "read");
            carolSocket.emit("read-message", { conversationId: group.id });
            expect((await full).messageIds).to.include(sent.data.message._id);
        });

        it("lets admins rename, add and remove members, and members leave", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const carol = await server.createUser("Carol");
            const dave = await server.createUser("Dave");
            const { data } = await json(server, alice, "POST", "/api/conversations", { name: "Club", participantIds: [bob.id] });
            const id = data.conversation.id;

            expect((await json(server, bob, "PATCH", `/api/conversations/${id}`, { name: "Hijack" })).status).to.equal(403);
            expect((await json(server, alice, "PATCH", `/api/conversations/${id}`, { name: "Book club" })).data.conversation.name).to.equal("Book club");
            const added = await json(server, alice, "POST", `/api/conversations/${id}/members`, { userIds: [carol.id, dave.id] });
            expect(added.data.conversation.participants).to.have.length(4);
            expect((await json(server, bob, "DELETE", `/api/conversations/${id}/members/${carol.id}`)).status).to.equal(403);
            expect((await json(server, alice, "DELETE", `/api/conversations/${id}/members/${carol.id}`)).status).to.equal(200);
            expect((await json(server, dave, "DELETE", `/api/conversations/${id}/members/${dave.id}`)).status).to.equal(200);
            expect((await json(server, carol, "GET", `/api/conversations/${id}/messages`)).status).to.equal(403);

            const history = await json(server, alice, "GET", `/api/conversations/${id}/messages`);
            const system = history.data.messages.filter((m) => m.type === "system").map((m) => m.message);
            expect(system.join(" | ")).to.match(/created the group.*renamed.*added.*removed.*left/);
        });

        it("hands admin rights on when the last admin leaves", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const { data } = await json(server, alice, "POST", "/api/conversations", { name: "Duo", participantIds: [bob.id] });
            await json(server, alice, "DELETE", `/api/conversations/${data.conversation.id}/members/${alice.id}`);
            const res = await json(server, bob, "GET", `/api/conversations/${data.conversation.id}`);
            expect(res.data.conversation.admins).to.deep.equal([bob.id]);
        });

        it("rejects groups with unknown members", async () => {
            const alice = await server.createUser("Alice");
            const res = await json(server, alice, "POST", "/api/conversations", { name: "X", participantIds: ["0123456789abcdef01234567"] });
            expect(res.status).to.equal(404);
        });
    });

    describe("reply, edit, delete and reactions", () => {
        it("supports replies, edits, reactions and delete-for-everyone with live updates", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            const { data: first } = await json(server, alice, "POST", "/api/messages/add-message", { to: bob.id, message: "original" });
            const reply = await json(server, bob, "POST", "/api/messages/add-message", { to: alice.id, message: "re", replyTo: first.message._id });
            expect(reply.data.message.replyTo).to.include({ _id: first.message._id, message: "original" });

            const updated = waitFor(bobSocket, "msg-updated");
            const edit = await json(server, alice, "PATCH", `/api/messages/${first.message._id}`, { message: "edited" });
            expect(edit.data.message.message).to.equal("edited");
            expect(edit.data.message.editedAt).to.be.a("string");
            expect((await updated).message.message).to.equal("edited");
            expect((await json(server, bob, "PATCH", `/api/messages/${first.message._id}`, { message: "nope" })).status).to.equal(403);

            const react = await json(server, bob, "POST", `/api/messages/${first.message._id}/reactions`, { emoji: "👍" });
            expect(react.data.message.reactions).to.deep.equal([{ user: bob.id, emoji: "👍" }]);
            const unreact = await json(server, bob, "POST", `/api/messages/${first.message._id}/reactions`, { emoji: "👍" });
            expect(unreact.data.message.reactions).to.deep.equal([]);

            const del = await json(server, alice, "DELETE", `/api/messages/${first.message._id}?scope=everyone`);
            expect(del.data).to.include({ deleted: true, message: "" });
            const history = await json(server, bob, "GET", `/api/messages/get-messages/${bob.id}/${alice.id}`);
            const tomb = history.data.messages.find((m) => m._id === first.message._id);
            expect(tomb).to.include({ deleted: true, message: "" });
        });

        it("delete-for-me hides the message only for the requester", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const { data } = await json(server, alice, "POST", "/api/messages/add-message", { to: bob.id, message: "private" });
            await json(server, bob, "DELETE", `/api/messages/${data.message._id}?scope=me`);
            const bobView = await json(server, bob, "GET", `/api/messages/get-messages/${bob.id}/${alice.id}`);
            const aliceView = await json(server, alice, "GET", `/api/messages/get-messages/${alice.id}/${bob.id}`);
            expect(bobView.data.messages).to.have.length(0);
            expect(aliceView.data.messages).to.have.length(1);
        });

        it("only lets the sender delete for everyone", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const { data } = await json(server, alice, "POST", "/api/messages/add-message", { to: bob.id, message: "mine" });
            expect((await json(server, bob, "DELETE", `/api/messages/${data.message._id}?scope=everyone`)).status).to.equal(403);
        });
    });

    describe("file messages", () => {
        it("accepts documents, serves them as attachments, and rejects executables/HTML", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const { data } = await json(server, alice, "POST", "/api/conversations/direct", { userId: bob.id });
            const post = (blob, name) => {
                const form = new FormData();
                form.append("file", blob, name);
                return server.request("POST", `/api/conversations/${data.conversation.id}/files`, { user: alice, body: form });
            };
            const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
            const ok = await post(new Blob([pdf], { type: "application/pdf" }), "report.pdf");
            expect(ok.status).to.equal(201);
            expect(ok.data.message).to.include({ type: "file" });
            expect(ok.data.message.file).to.include({ name: "report.pdf", mime: "application/pdf" });
            const file = await fetch(server.baseUrl + ok.data.message.mediaUrl);
            expect(file.headers.get("content-disposition")).to.match(/attachment; filename="report.pdf"/);

            const txt = await post(new Blob(["hello"], { type: "text/plain" }), "notes.txt");
            expect(txt.status).to.equal(201);
            const html = await post(new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
            expect(html.status).to.equal(415);
            const exe = await post(new Blob([Buffer.from("4d5a900003", "hex")], { type: "application/octet-stream" }), "x.exe");
            expect(exe.status).to.equal(415);
        });
    });

    describe("typing indicators", () => {
        it("relays typing / stop-typing to the other participant only", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const carol = await server.createUser("Carol");
            await json(server, alice, "POST", "/api/conversations/direct", { userId: bob.id });
            const aliceSocket = track(await server.connect(alice));
            const bobSocket = track(await server.connect(bob));
            const carolSocket = track(await server.connect(carol));
            const leaked = collect(carolSocket, "typing", 600);
            const typing = waitFor(bobSocket, "typing");
            aliceSocket.emit("typing", { to: bob.id });
            expect((await typing).userId).to.equal(alice.id);
            const stop = waitFor(bobSocket, "stop-typing");
            aliceSocket.emit("stop-typing", { to: bob.id });
            await stop;
            expect(await leaked).to.have.length(0);
        });
    });

    describe("blocking and reporting", () => {
        it("blocks messages and calls in both directions until unblocked", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            await json(server, alice, "POST", `/api/users/${bob.id}/block`);
            expect((await json(server, bob, "POST", "/api/messages/add-message", { to: alice.id, message: "hey" })).status).to.equal(403);
            expect((await json(server, alice, "POST", "/api/messages/add-message", { to: bob.id, message: "hey" })).status).to.equal(403);
            const contacts = await json(server, bob, "GET", "/api/auth/get-contacts");
            expect(Object.values(contacts.data.users).flat().map((u) => u.id)).to.not.include(alice.id);

            track(await server.connect(alice));
            const bobSocket = track(await server.connect(bob));
            const unavailable = waitFor(bobSocket, "call-unavailable");
            bobSocket.emit("outgoing-voice-call", { to: alice.id, roomId: "r1" });
            expect((await unavailable).reason).to.equal("unavailable");

            await json(server, alice, "DELETE", `/api/users/${bob.id}/block`);
            expect((await json(server, bob, "POST", "/api/messages/add-message", { to: alice.id, message: "hey" })).status).to.equal(201);
        });

        it("records a report", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const res = await json(server, alice, "POST", `/api/users/${bob.id}/report`, { reason: "spam" });
            expect(res.status).to.equal(201);
            const count = await (await server.db()).collection("reports").countDocuments({ reason: "spam" });
            expect(count).to.equal(1);
        });
    });

    describe("presence details", () => {
        it("publishes last seen when a user goes offline", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const bobSocket = track(await server.connect(bob));
            const aliceSocket = await server.connect(alice);
            const offline = waitFor(bobSocket, "user-offline");
            aliceSocket.close();
            const evt = await offline;
            expect(evt.userId).to.equal(alice.id);
            const profile = await json(server, bob, "GET", `/api/users/${alice.id}`);
            expect(profile.data.user.lastSeen).to.equal(new Date(evt.lastSeen).toISOString());
            expect(profile.data.user.online).to.equal(false);
        });
    });

    describe("calls", () => {
        it("reports busy, logs missed/declined/completed calls in the chat", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const carol = await server.createUser("Carol");
            const aliceSocket = track(await server.connect(alice));
            const bobSocket = track(await server.connect(bob));
            const carolSocket = track(await server.connect(carol));

            // Declined
            let ring = waitFor(bobSocket, "incoming-voice-call");
            aliceSocket.emit("outgoing-voice-call", { to: bob.id, roomId: "r1" });
            await ring;
            const declined = waitFor(aliceSocket, "call-ended");
            bobSocket.emit("reject-voice-call", {});
            expect((await declined).reason).to.equal("declined");

            // Busy: Bob is in a call with Alice when Carol rings him.
            ring = waitFor(bobSocket, "incoming-video-call");
            aliceSocket.emit("outgoing-video-call", { to: bob.id, roomId: "r2" });
            await ring;
            const accepted = waitFor(aliceSocket, "accept-call");
            bobSocket.emit("accept-incoming-call", { id: alice.id });
            await accepted;
            const busy = waitFor(carolSocket, "call-unavailable");
            carolSocket.emit("outgoing-voice-call", { to: bob.id, roomId: "r3" });
            expect((await busy).reason).to.equal("busy");
            await delay(1100);
            const ended = waitFor(bobSocket, "call-ended");
            aliceSocket.emit("reject-video-call", {});
            expect((await ended).reason).to.equal("ended");
            await delay(300);

            const log = await json(server, alice, "GET", `/api/messages/get-messages/${alice.id}/${bob.id}`);
            const calls = log.data.messages.filter((m) => m.type === "call").map((m) => m.message);
            expect(calls[0]).to.equal("Declined voice call");
            expect(calls[1]).to.match(/^Video call · \d+s$/);
            const carolLog = await json(server, carol, "GET", `/api/messages/get-messages/${carol.id}/${bob.id}`);
            expect(carolLog.data.messages.map((m) => m.message)).to.include("Missed voice call");
        });

        it("stops ringing on the callee's other tabs when one tab answers", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            const aliceSocket = track(await server.connect(alice));
            const bobTab1 = track(await server.connect(bob));
            const bobTab2 = track(await server.connect(bob));
            const ring = waitFor(bobTab2, "incoming-voice-call");
            aliceSocket.emit("outgoing-voice-call", { to: bob.id, roomId: "r9" });
            await ring;
            const elsewhere = waitFor(bobTab2, "call-ended");
            bobTab1.emit("accept-incoming-call", { id: alice.id });
            expect((await elsewhere).reason).to.equal("answered-elsewhere");
        });
    });

    describe("account deletion", () => {
        it("removes personal data and lets the identity onboard again", async () => {
            const alice = await server.createUser("Alice");
            const bob = await server.createUser("Bob");
            await json(server, alice, "POST", "/api/messages/add-message", { to: bob.id, message: "bye" });
            expect((await json(server, alice, "DELETE", "/api/auth/account")).status).to.equal(204);
            expect((await json(server, alice, "POST", "/api/auth/check-user")).data.status).to.equal(false);
            const chats = await json(server, bob, "GET", "/api/conversations");
            const row = chats.data.conversations.find((c) => c.partnerId === alice.id);
            expect(row.name).to.equal("Deleted user");
            expect((await json(server, bob, "POST", "/api/messages/add-message", { to: alice.id, message: "?" })).status).to.equal(404);
            const again = await json(server, alice, "POST", "/api/auth/onboard-user", { name: "Alice Again" });
            expect(again.status).to.equal(200);
        });
    });

    describe("link previews", () => {
        it("refuses to fetch private network addresses (SSRF guard)", async () => {
            const alice = await server.createUser("Alice");
            for (const url of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://localhost:27017/"]) {
                const res = await json(server, alice, "GET", `/api/link-preview?url=${encodeURIComponent(url)}`);
                expect(res.status).to.equal(200);
                expect(res.data.preview).to.equal(null);
            }
            const bad = await json(server, alice, "GET", `/api/link-preview?url=${encodeURIComponent("file:///etc/passwd")}`);
            expect(bad.status).to.equal(400);
        });
    });
});

describe("Rate limiting", () => {
    it("returns 429 once the per-user API budget is exhausted", async () => {
        const server = await startServer({ env: { RATE_LIMIT_MAX: "5" } });
        try {
            const alice = await server.createUser("Alice");
            const statuses = [];
            for (let i = 0; i < 6; i++) statuses.push((await server.request("POST", "/api/auth/check-user", { user: alice })).status);
            expect(statuses).to.include(429);
            expect((await server.request("GET", "/health")).status).to.equal(200);
        } finally {
            await server.stop();
        }
    });
});
