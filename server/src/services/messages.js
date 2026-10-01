import mongoose from "mongoose";
import { config } from "../config.js";
import { badRequest, forbidden, HttpError, notFound } from "../errors.js";
import { Conversation } from "../models/Conversation.js";
import { Message, recomputeStatusPipeline } from "../models/Message.js";
import { assertCanMessage, isParticipant } from "./conversations.js";
import { presence } from "./presence.js";
import { realtime } from "./realtime.js";
import { messageDto } from "./serialize.js";
import { pathToKey, storage } from "./storage.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const REPLY_FIELDS = "sender type message file deletedAt";
const MEDIA_TYPES = new Set(["image", "audio", "file"]);

function initialStatus(recipients, delivered) {
    if (!recipients.length) return "read";
    return delivered.length === recipients.length ? "delivered" : "sent";
}

// Persists a message, bumps the conversation and pushes it to every participant's sockets.
export async function createMessage({ conv, senderId, type = "text", message, file, replyToId, tempId, system = false }) {
    if (!system) await assertCanMessage(conv, senderId);
    let replyTo = null;
    if (replyToId) {
        replyTo = await Message.findOne({ _id: replyToId, conversation: conv._id }, "_id");
        if (!replyTo) throw badRequest("replyTo must be a message in this conversation");
    }
    const recipients = system ? [] : conv.participants.filter((p) => String(p) !== String(senderId));
    const deliveredTo = recipients.filter((p) => presence.isOnline(String(p)));
    const doc = await Message.create({
        conversation: conv._id,
        sender: senderId,
        receiver: conv.type === "direct" ? recipients[0] ?? null : null,
        recipients,
        deliveredTo,
        readBy: [],
        type,
        message,
        file,
        replyTo: replyTo?._id ?? null,
        messageStatus: initialStatus(recipients, deliveredTo),
    });
    await Conversation.updateOne({ _id: conv._id }, { lastMessage: doc._id, lastMessageAt: doc.createdAt });
    await doc.populate({ path: "replyTo", select: REPLY_FIELDS });

    const dto = messageDto(doc);
    const payload = { from: String(senderId), conversationId: String(conv._id), message: dto };
    const others = conv.participants.filter((p) => String(p) !== String(senderId));
    realtime.emitToUsers(others, "msg-recieve", payload);
    // The sender's other tabs/devices; tempId lets the sending tab reconcile its optimistic copy.
    realtime.emitToUser(senderId, "msg-recieve", { ...payload, message: { ...dto, ...(tempId ? { tempId } : {}) } });
    return tempId ? { ...dto, tempId } : dto;
}

export async function createSystemMessage(conv, actorId, text) {
    return createMessage({ conv, senderId: actorId, type: "system", message: text, system: true });
}

// Tells senders about messages that changed state. Payload keeps the legacy
// `messageId` field when a single message is affected.
async function notifyStatus(ids) {
    if (!ids.length) return;
    const msgs = await Message.find({ _id: { $in: ids } }, "sender messageStatus conversation").lean();
    const groups = new Map();
    for (const m of msgs) {
        if (!m.sender || m.messageStatus === "sent") continue;
        const k = `${m.sender}|${m.messageStatus}|${m.conversation}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(String(m._id));
    }
    for (const [k, messageIds] of groups) {
        const [sender, status, conversationId] = k.split("|");
        const event = status === "read" ? "read" : "delivered";
        realtime.emitToUser(sender, event, {
            messageIds,
            conversationId,
            ...(messageIds.length === 1 ? { messageId: messageIds[0] } : {}),
        });
    }
}

async function markAs(field, userId, extraFilter) {
    const uid = oid(userId);
    const filter = { recipients: uid, [field]: { $ne: uid }, ...extraFilter };
    if (field === "deliveredTo") filter.readBy = { $ne: uid };
    const ids = (await Message.find(filter, "_id").limit(5000).lean()).map((m) => m._id);
    if (!ids.length) return [];
    const add = field === "readBy" ? { readBy: { $setUnion: ["$readBy", [uid]] }, deliveredTo: { $setUnion: ["$deliveredTo", [uid]] } } : { deliveredTo: { $setUnion: ["$deliveredTo", [uid]] } };
    await Message.updateMany({ _id: { $in: ids } }, [{ $set: add }, ...recomputeStatusPipeline]);
    await notifyStatus(ids);
    return ids.map(String);
}

export const markDelivered = (userId, extra = {}) => markAs("deliveredTo", userId, extra);

export function markRead(userId, { messageIds, conversationId } = {}) {
    const extra = {};
    if (messageIds) extra._id = { $in: messageIds.map(oid) };
    if (conversationId) extra.conversation = oid(conversationId);
    return markAs("readBy", userId, extra);
}

export async function listMessages(conv, userId, { limit = 50, before } = {}) {
    const filter = { conversation: conv._id, deletedFor: { $ne: oid(userId) } };
    if (before) filter._id = { $lt: oid(before) };
    const docs = await Message.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate({ path: "replyTo", select: REPLY_FIELDS });
    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit).reverse();
    return { messages: page.map((m) => messageDto(m)), hasMore, nextCursor: hasMore ? String(page[0]._id) : null };
}

async function loadOwnMessage(userId, messageId) {
    const msg = await Message.findById(messageId).populate({ path: "replyTo", select: REPLY_FIELDS });
    if (!msg) throw notFound("Message not found");
    const conv = await Conversation.findById(msg.conversation);
    if (!conv || !isParticipant(conv, userId)) throw notFound("Message not found");
    return { msg, conv };
}

const minutesSince = (date) => (Date.now() - new Date(date).getTime()) / 60000;

function broadcastUpdate(conv, msg) {
    realtime.emitToUsers(conv.participants, "msg-updated", { conversationId: String(conv._id), message: messageDto(msg) });
}

export async function editMessage(userId, messageId, text) {
    const { msg, conv } = await loadOwnMessage(userId, messageId);
    if (String(msg.sender) !== String(userId)) throw forbidden("You can only edit your own messages");
    if (msg.type !== "text" || msg.deletedAt) throw badRequest("Only text messages can be edited");
    if (minutesSince(msg.createdAt) > config.MESSAGE_EDIT_WINDOW_MINUTES) {
        throw new HttpError(403, "edit_window_passed", `Messages can only be edited for ${config.MESSAGE_EDIT_WINDOW_MINUTES} minutes`);
    }
    msg.message = text;
    msg.editedAt = new Date();
    await msg.save();
    broadcastUpdate(conv, msg);
    return messageDto(msg);
}

export async function deleteMessage(userId, messageId, scope) {
    const { msg, conv } = await loadOwnMessage(userId, messageId);
    if (scope === "me") {
        await Message.updateOne({ _id: msg._id }, { $addToSet: { deletedFor: oid(userId) } });
        realtime.emitToUser(userId, "msg-removed", { conversationId: String(conv._id), messageId: String(msg._id) });
        return { removed: true };
    }
    if (String(msg.sender) !== String(userId)) throw forbidden("You can only delete your own messages for everyone");
    if (minutesSince(msg.createdAt) > config.MESSAGE_DELETE_WINDOW_MINUTES) {
        throw new HttpError(403, "delete_window_passed", "This message is too old to delete for everyone");
    }
    if (MEDIA_TYPES.has(msg.type)) {
        const key = pathToKey(msg.message);
        if (key) await storage.remove(key);
    }
    msg.deletedAt = new Date();
    msg.message = "";
    msg.file = undefined;
    msg.reactions = [];
    await msg.save();
    broadcastUpdate(conv, msg);
    return messageDto(msg);
}

export async function toggleReaction(userId, messageId, emoji) {
    const { msg, conv } = await loadOwnMessage(userId, messageId);
    if (msg.deletedAt) throw badRequest("Cannot react to a deleted message");
    const mine = msg.reactions.find((r) => String(r.user) === String(userId));
    if (mine && mine.emoji === emoji) msg.reactions = msg.reactions.filter((r) => r !== mine);
    else if (mine) mine.emoji = emoji;
    else msg.reactions.push({ user: userId, emoji });
    await msg.save();
    broadcastUpdate(conv, msg);
    return messageDto(msg);
}

const CALL_LABEL = { voice: "voice call", video: "video call" };
const formatDuration = (ms) => {
    const s = Math.max(1, Math.round(ms / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

// Writes a call-log entry into the direct chat. Missed calls stay unread for the callee.
export async function createCallLog({ conv, callerId, callType, outcome, durationMs }) {
    const label = CALL_LABEL[callType] || "call";
    const text =
        outcome === "completed"
            ? `${label[0].toUpperCase()}${label.slice(1)} · ${formatDuration(durationMs)}`
            : outcome === "declined"
              ? `Declined ${label}`
              : `Missed ${label}`;
    const recipients = conv.participants.filter((p) => String(p) !== String(callerId));
    const readBy = outcome === "missed" ? [] : recipients;
    const doc = await Message.create({
        conversation: conv._id,
        sender: callerId,
        receiver: recipients[0] ?? null,
        recipients,
        deliveredTo: recipients.filter((p) => presence.isOnline(String(p))),
        readBy,
        type: "call",
        message: text,
        messageStatus: readBy.length ? "read" : "sent",
    });
    await Conversation.updateOne({ _id: conv._id }, { lastMessage: doc._id, lastMessageAt: doc.createdAt });
    const dto = messageDto(doc);
    realtime.emitToUsers(conv.participants, "msg-recieve", { from: String(callerId), conversationId: String(conv._id), message: dto });
    return dto;
}
