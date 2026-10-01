import { forbidden, notFound } from "../errors.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { PUBLIC_USER_FIELDS, User } from "../models/User.js";
import { presence } from "./presence.js";
import { messageDto } from "./serialize.js";

const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);
export const isParticipant = (conv, userId) => conv.participants.some((p) => sameId(p, userId));
export const isAdmin = (conv, userId) => conv.admins?.some((a) => sameId(a, userId));

export async function findActiveUser(userId) {
    const user = await User.findById(userId);
    if (!user || user.deletedAt) throw notFound("User not found");
    return user;
}

export async function findDirect(meId, otherId) {
    return Conversation.findOne({ directKey: Conversation.directKeyFor(meId, otherId) });
}

export async function getOrCreateDirect(meId, otherId) {
    if (sameId(meId, otherId)) throw forbidden("You cannot start a chat with yourself");
    await findActiveUser(otherId);
    const directKey = Conversation.directKeyFor(meId, otherId);
    try {
        return await Conversation.findOneAndUpdate(
            { directKey },
            { $setOnInsert: { type: "direct", participants: [meId, otherId], directKey } },
            { upsert: true, new: true },
        );
    } catch (err) {
        if (err?.code === 11000) return Conversation.findOne({ directKey }); // concurrent create
        throw err;
    }
}

export async function loadConversationFor(userId, conversationId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw notFound("Conversation not found");
    if (!isParticipant(conv, userId)) throw forbidden("You are not a member of this conversation");
    return conv;
}

// Rejects direct messages between users where either side has blocked the other.
export async function assertCanMessage(conv, senderId) {
    if (conv.type !== "direct") return;
    const otherId = conv.participants.find((p) => !sameId(p, senderId));
    const [me, other] = await Promise.all([User.findById(senderId, "blockedUsers"), User.findById(otherId, "blockedUsers deletedAt")]);
    if (!other || other.deletedAt) throw forbidden("This account no longer exists");
    if (me?.blockedUsers?.some((b) => sameId(b, otherId))) throw forbidden("Unblock this contact to send messages");
    if (other.blockedUsers?.some((b) => sameId(b, senderId))) throw forbidden("You can't message this contact");
}

const publicUser = (u) => ({
    id: String(u._id),
    _id: String(u._id),
    name: u.deletedAt ? "Deleted user" : u.name,
    about: u.deletedAt ? "" : u.about,
    profilePicture: u.deletedAt ? "/default_avatar.png" : u.profilePicture,
    lastSeen: u.lastSeen || null,
});

async function unreadCounts(userId, convIds) {
    if (!convIds.length) return new Map();
    const rows = await Message.aggregate([
        {
            $match: {
                conversation: { $in: convIds },
                recipients: userId,
                readBy: { $ne: userId },
                deletedAt: null,
                deletedFor: { $ne: userId },
            },
        },
        { $group: { _id: "$conversation", n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.n]));
}

// Chat-list rows. Flat legacy fields (name, message, totalUnreadMessages, …) are kept
// alongside the structured ones so older clients keep working.
export async function chatRows(viewer, conversations) {
    const convs = await Conversation.populate(conversations, [
        { path: "participants", select: PUBLIC_USER_FIELDS },
        { path: "lastMessage", populate: { path: "replyTo", select: "sender type message file deletedAt" } },
    ]);
    const unread = await unreadCounts(
        viewer._id,
        convs.map((c) => c._id),
    );
    const blocked = new Set((viewer.blockedUsers || []).map(String));

    return convs.map((conv) => {
        const id = String(conv._id);
        const participants = conv.participants.filter(Boolean).map(publicUser);
        const last = conv.lastMessage ? messageDto(conv.lastMessage) : null;
        const isGroup = conv.type === "group";
        const partner = isGroup ? null : participants.find((p) => p.id !== String(viewer._id)) || null;
        const count = unread.get(id) || 0;
        return {
            id,
            conversationId: id,
            isGroup,
            partnerId: partner?.id ?? null,
            _id: partner?.id ?? id,
            name: isGroup ? conv.name : (partner?.name ?? "Deleted user"),
            about: isGroup ? conv.description : (partner?.about ?? ""),
            profilePicture: isGroup ? conv.avatarUrl || "/group_avatar.svg" : (partner?.profilePicture ?? "/default_avatar.png"),
            lastSeen: partner?.lastSeen ?? null,
            online: partner ? presence.isOnline(partner.id) : false,
            blocked: partner ? blocked.has(partner.id) : false,
            participants,
            admins: (conv.admins || []).map(String),
            createdBy: conv.createdBy ? String(conv.createdBy) : null,
            lastMessage: last,
            messageId: last?._id ?? null,
            message: last?.message ?? "",
            type: last?.type ?? "text",
            messageStatus: last?.messageStatus ?? null,
            sender: last?.sender ?? null,
            receiver: last?.receiver ?? null,
            createdAt: last?.createdAt ?? conv.createdAt,
            totalUnreadMessages: count,
            unreadCount: count,
        };
    });
}

export async function chatRowFor(viewer, conv) {
    return (await chatRows(viewer, [conv]))[0];
}

export async function listChats(viewer) {
    const convs = await Conversation.find({ participants: viewer._id, lastMessageAt: { $ne: null } })
        .sort({ lastMessageAt: -1 })
        .limit(500);
    return chatRows(viewer, convs);
}
