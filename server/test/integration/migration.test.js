import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect } from "chai";
import mongoose from "mongoose";
import { makeUser, startServer } from "../helpers/harness.js";

const run = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/migrate.js");

describe("Data migration (scripts/migrate.js)", () => {
    it("upgrades legacy users/messages so the new API serves them", async () => {
        const server = await startServer();
        try {
            const db = await server.db();
            const alice = makeUser("Alice");
            const bob = makeUser("Bob");
            const aId = new mongoose.Types.ObjectId();
            const bId = new mongoose.Types.ObjectId();
            const m1 = new mongoose.Types.ObjectId();
            const m2 = new mongoose.Types.ObjectId();
            // Documents exactly as the original server stored them.
            await db.collection("users").insertMany([
                { _id: aId, email: alice.email, name: "Alice", about: "", profilePicture: "", sentMessages: [m1], receivedMessages: [m2] },
                { _id: bId, email: bob.email, name: "Bob", about: "", profilePicture: "/avatars/1.png", sentMessages: [m2], receivedMessages: [m1] },
            ]);
            await db.collection("messages").insertMany([
                { _id: m1, sender: aId, receiver: bId, type: "text", message: "old one", messageStatus: "read", createdAt: new Date(Date.now() - 60000) },
                { _id: m2, sender: bId, receiver: aId, type: "text", message: "old two", messageStatus: "sent", createdAt: new Date() },
            ]);

            const { stdout } = await run(process.execPath, [script], { env: { ...process.env, MONGOURL: server.mongoUri } });
            expect(stdout).to.match(/attached 2/);
            await run(process.execPath, [script], { env: { ...process.env, MONGOURL: server.mongoUri } }); // idempotent

            const userDoc = await db.collection("users").findOne({ _id: aId });
            expect(userDoc).to.not.have.property("sentMessages");

            // Legacy users have no firebaseUid yet; it is linked by email on first request.
            const chats = await server.request("GET", "/api/conversations", { user: alice });
            expect(chats.status).to.equal(200);
            expect(chats.data.conversations).to.have.length(1);
            expect(chats.data.conversations[0]).to.include({ name: "Bob", message: "old two", unreadCount: 1 });
            const history = await server.request("GET", `/api/messages/get-messages/${aId}/${bId}`, { user: alice });
            expect(history.data.messages.map((m) => m.message)).to.deep.equal(["old one", "old two"]);
        } finally {
            await server.stop();
        }
    });
});
