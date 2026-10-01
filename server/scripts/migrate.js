// One-off, idempotent migration from the original schema:
//  - attaches every legacy message (sender/receiver only) to a direct Conversation
//  - fills recipients/deliveredTo/readBy from the old messageStatus
//  - sets each conversation's lastMessage / lastMessageAt
//  - removes the unbounded User.sentMessages / receivedMessages arrays
//  - builds the indexes declared on the models
// Usage: MONGOURL=mongodb://... node scripts/migrate.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Conversation } from "../src/models/Conversation.js";
import { Message } from "../src/models/Message.js";
import { Report } from "../src/models/Report.js";
import { User } from "../src/models/User.js";

dotenv.config();

export async function migrate(log = console.log) {
    const users = User.collection;
    const messages = Message.collection;

    const unset = await users.updateMany(
        { $or: [{ sentMessages: { $exists: true } }, { receivedMessages: { $exists: true } }] },
        { $unset: { sentMessages: "", receivedMessages: "" } },
    );
    await users.updateMany({ $or: [{ profilePicture: "" }, { profilePicture: null }] }, { $set: { profilePicture: "/default_avatar.png" } });
    await users.updateMany({ deletedAt: { $exists: false } }, { $set: { deletedAt: null, blockedUsers: [], lastSeen: null } });
    log(`users: removed message arrays from ${unset.modifiedCount}`);

    let attached = 0;
    const convCache = new Map();
    const cursor = messages.find({ conversation: { $exists: false }, sender: { $ne: null }, receiver: { $ne: null } });
    for await (const m of cursor) {
        const key = Conversation.directKeyFor(m.sender, m.receiver);
        let convId = convCache.get(key);
        if (!convId) {
            const conv = await Conversation.findOneAndUpdate(
                { directKey: key },
                { $setOnInsert: { type: "direct", participants: [m.sender, m.receiver], directKey: key } },
                { upsert: true, new: true },
            );
            convId = conv._id;
            convCache.set(key, convId);
        }
        const status = ["sent", "delivered", "read"].includes(m.messageStatus) ? m.messageStatus : "sent";
        await messages.updateOne(
            { _id: m._id },
            {
                $set: {
                    conversation: convId,
                    recipients: [m.receiver],
                    deliveredTo: status === "sent" ? [] : [m.receiver],
                    readBy: status === "read" ? [m.receiver] : [],
                    messageStatus: status,
                    type: m.type || "text",
                    deletedAt: null,
                    deletedFor: [],
                    reactions: [],
                    replyTo: null,
                    editedAt: null,
                },
            },
        );
        attached++;
    }
    log(`messages: attached ${attached} to conversations`);

    const latest = await messages
        .aggregate([{ $sort: { _id: -1 } }, { $group: { _id: "$conversation", last: { $first: "$_id" }, at: { $first: "$createdAt" } } }])
        .toArray();
    for (const row of latest) {
        if (row._id) await Conversation.updateOne({ _id: row._id }, { lastMessage: row.last, lastMessageAt: row.at });
    }
    log(`conversations: refreshed ${latest.length}`);

    for (const model of [User, Conversation, Message, Report]) await model.syncIndexes();
    log("indexes: synced");
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.MONGOURL) {
        console.error("MONGOURL is required");
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGOURL);
    await migrate();
    await mongoose.disconnect();
}
