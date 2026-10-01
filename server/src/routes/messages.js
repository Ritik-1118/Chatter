// Message operations plus the original (pre-conversation) endpoints, which address a
// direct chat by the partner's user id. The sender is always the authenticated user.
import { Router } from "express";
import { z } from "zod";
import { badRequest, forbidden } from "../errors.js";
import { requireProfile } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { audioUpload, fileUpload, imageUpload } from "../middleware/upload.js";
import { findDirect, getOrCreateDirect, listChats, loadConversationFor } from "../services/conversations.js";
import { deleteMessage, editMessage, listMessages, markDelivered, markRead, toggleReaction } from "../services/messages.js";
import { presence } from "../services/presence.js";
import { assertObjectId, objectId, parse } from "../validate.js";
import { sendMedia, sendText, textSchema } from "./messageHandlers.js";

const router = Router();

function assertSelf(req, from) {
    if (from !== undefined && from !== null && String(from) !== String(req.user._id)) {
        throw forbidden("Forbidden: sender mismatch");
    }
}

// Resolves the target conversation from either `conversationId` or the partner id `to`.
async function targetConversation(req, { to, conversationId }) {
    if (conversationId) return loadConversationFor(req.user._id, assertObjectId(String(conversationId), "conversationId"));
    if (!to) throw badRequest("`to` or `conversationId` is required");
    return getOrCreateDirect(req.user._id, assertObjectId(String(to), "to"));
}

router.post("/add-message", requireProfile, async (req, res) => {
    const body = req.body ?? {};
    assertSelf(req, body.from);
    parse(textSchema, body); // validate before creating a conversation
    const conv = await targetConversation(req, body);
    res.status(201).json({ message: await sendText(conv, req.user, body) });
});

const pageSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: objectId("before").optional(),
});

router.get("/get-messages/:from/:to", requireProfile, async (req, res) => {
    if (req.params.from !== String(req.user._id)) throw forbidden("Forbidden: cannot read other users' messages");
    const to = assertObjectId(req.params.to, "to");
    const page = parse(pageSchema, req.query);
    const conv = await findDirect(req.user._id, to);
    if (!conv) return res.json({ messages: [], hasMore: false, nextCursor: null, conversationId: null });
    if (!page.before) await markRead(req.user._id, { conversationId: conv._id });
    res.json({ ...(await listMessages(conv, req.user._id, page)), conversationId: String(conv._id) });
});

router.get("/get-initial-contacts/:from", requireProfile, async (req, res) => {
    if (req.params.from !== String(req.user._id)) throw forbidden("Forbidden: cannot access contacts for another user");
    await markDelivered(req.user._id);
    res.json({ users: await listChats(req.user), onlineUsers: presence.onlineUserIds() });
});

const legacyMedia = (path, upload, type) =>
    router.post(path, requireProfile, uploadLimiter, upload, async (req, res) => {
        assertSelf(req, req.query.from);
        const conv = await targetConversation(req, { to: req.query.to, conversationId: req.query.conversationId });
        res.status(201).json({ message: await sendMedia(conv, req.user, type, req.file, { ...req.query, ...req.body }) });
    });
legacyMedia("/add-image-message", imageUpload, "image");
legacyMedia("/add-audio-message", audioUpload, "audio");
legacyMedia("/add-file-message", fileUpload, "file");

router.patch("/:id", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "message id");
    const { message } = parse(textSchema.pick({ message: true }), req.body);
    res.json({ message: await editMessage(req.user._id, id, message) });
});

router.delete("/:id", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "message id");
    const { scope } = parse(z.object({ scope: z.enum(["everyone", "me"]).optional().default("me") }), req.query);
    res.json(await deleteMessage(req.user._id, id, scope));
});

router.post("/:id/reactions", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "message id");
    const { emoji } = parse(z.object({ emoji: z.string().min(1).max(16) }), req.body);
    res.json({ message: await toggleReaction(req.user._id, id, emoji) });
});

router.post("/read", requireProfile, async (req, res) => {
    const { messageIds } = parse(z.object({ messageIds: z.array(objectId("messageIds[]")).max(500) }), req.body);
    res.json({ messageIds: await markRead(req.user._id, { messageIds }) });
});

export default router;
