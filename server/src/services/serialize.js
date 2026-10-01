import { pathToKey, signedMediaPath } from "./storage.js";

const MEDIA_TYPES = new Set(["image", "audio", "file"]);
const idOf = (v) => (v === null || v === undefined ? null : String(v._id ?? v));

function replyDto(r) {
    if (!r || !r._id) return r ? { _id: String(r), id: String(r) } : null;
    const deleted = Boolean(r.deletedAt);
    return {
        _id: String(r._id),
        id: String(r._id),
        sender: idOf(r.sender),
        type: r.type,
        message: deleted ? "" : MEDIA_TYPES.has(r.type) ? r.file?.name || "" : String(r.message || "").slice(0, 200),
        deleted,
    };
}

// The single wire format for messages (REST responses and socket events).
export function messageDto(m, { tempId } = {}) {
    const deleted = Boolean(m.deletedAt);
    const key = MEDIA_TYPES.has(m.type) && !deleted ? pathToKey(m.message) : null;
    return {
        _id: String(m._id),
        id: String(m._id),
        conversationId: idOf(m.conversation),
        sender: idOf(m.sender),
        receiver: idOf(m.receiver),
        type: m.type,
        message: deleted ? "" : m.message,
        mediaUrl: key ? signedMediaPath(key) : null,
        file: m.file?.name ? { name: m.file.name, size: m.file.size, mime: m.file.mime } : null,
        messageStatus: m.messageStatus,
        readBy: (m.readBy || []).map(String),
        replyTo: replyDto(m.replyTo),
        reactions: deleted ? [] : (m.reactions || []).map((r) => ({ user: String(r.user), emoji: r.emoji })),
        editedAt: m.editedAt || null,
        deleted,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        ...(tempId ? { tempId } : {}),
    };
}
