import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { requireProfile } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { audioUpload, fileUpload, imageUpload } from "../middleware/upload.js";
import { Conversation } from "../models/Conversation.js";
import { User } from "../models/User.js";
import { resolveAvatar } from "../services/avatars.js";
import { chatRowFor, getOrCreateDirect, isAdmin, listChats, loadConversationFor } from "../services/conversations.js";
import { createSystemMessage, listMessages, markRead } from "../services/messages.js";
import { realtime } from "../services/realtime.js";
import { assertObjectId, objectId, parse } from "../validate.js";
import { sendMedia, sendText } from "./messageHandlers.js";

const router = Router();
router.use(requireProfile);

const groupName = z.string().trim().min(1, "Group name is required").max(60);
const createGroupSchema = z.object({
    name: groupName,
    description: z.string().trim().max(200).optional().default(""),
    participantIds: z.array(objectId("participantIds[]")).min(1, "Add at least one member"),
    avatar: z.string().optional(),
});
const updateGroupSchema = z.object({
    name: groupName.optional(),
    description: z.string().trim().max(200).optional(),
    avatar: z.string().optional(),
});
const pageSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: objectId("before").optional(),
});

const notifyChanged = (ids, conversationId) =>
    realtime.emitToUsers(ids, "conversation-updated", { conversationId: String(conversationId) });

async function loadGroupAsAdmin(user, id) {
    const conv = await loadConversationFor(user._id, assertObjectId(id, "conversation id"));
    if (conv.type !== "group") throw badRequest("Not a group conversation");
    if (!isAdmin(conv, user._id)) throw forbidden("Only group admins can do that");
    return conv;
}

async function activeUsers(ids) {
    const users = await User.find({ _id: { $in: ids }, deletedAt: null }, "name");
    if (users.length !== new Set(ids.map(String)).size) throw notFound("One or more users were not found");
    return users;
}

router.get("/", async (req, res) => {
    res.json({ conversations: await listChats(req.user) });
});

router.post("/direct", async (req, res) => {
    const { userId } = parse(z.object({ userId: objectId("userId") }), req.body);
    const conv = await getOrCreateDirect(req.user._id, userId);
    res.json({ conversation: await chatRowFor(req.user, conv) });
});

router.post("/", async (req, res) => {
    const body = parse(createGroupSchema, req.body);
    const memberIds = [...new Set(body.participantIds.filter((id) => id !== String(req.user._id)))];
    if (!memberIds.length) throw badRequest("Add at least one member");
    if (memberIds.length + 1 > config.GROUP_MAX_MEMBERS) throw badRequest(`Groups are limited to ${config.GROUP_MAX_MEMBERS} members`);
    await activeUsers(memberIds);
    const conv = await Conversation.create({
        type: "group",
        name: body.name,
        description: body.description,
        avatarUrl: (await resolveAvatar(body.avatar)) ?? "",
        participants: [req.user._id, ...memberIds],
        admins: [req.user._id],
        createdBy: req.user._id,
    });
    await createSystemMessage(conv, req.user._id, `${req.user.name} created the group "${conv.name}"`);
    notifyChanged(conv.participants, conv._id);
    res.status(201).json({ conversation: await chatRowFor(req.user, await Conversation.findById(conv._id)) });
});

router.get("/:id", async (req, res) => {
    const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
    res.json({ conversation: await chatRowFor(req.user, conv) });
});

router.patch("/:id", async (req, res) => {
    const conv = await loadGroupAsAdmin(req.user, req.params.id);
    const body = parse(updateGroupSchema, req.body);
    const changes = [];
    if (body.name !== undefined && body.name !== conv.name) {
        changes.push(`${req.user.name} renamed the group to "${body.name}"`);
        conv.name = body.name;
    }
    if (body.description !== undefined) conv.description = body.description;
    if (body.avatar !== undefined) {
        conv.avatarUrl = (await resolveAvatar(body.avatar)) ?? "";
        changes.push(`${req.user.name} changed the group photo`);
    }
    await conv.save();
    for (const text of changes) await createSystemMessage(conv, req.user._id, text);
    notifyChanged(conv.participants, conv._id);
    res.json({ conversation: await chatRowFor(req.user, conv) });
});

router.post("/:id/members", async (req, res) => {
    const conv = await loadGroupAsAdmin(req.user, req.params.id);
    const { userIds } = parse(z.object({ userIds: z.array(objectId("userIds[]")).min(1) }), req.body);
    const toAdd = [...new Set(userIds)].filter((id) => !conv.participants.some((p) => String(p) === id));
    if (conv.participants.length + toAdd.length > config.GROUP_MAX_MEMBERS) {
        throw badRequest(`Groups are limited to ${config.GROUP_MAX_MEMBERS} members`);
    }
    const users = await activeUsers(toAdd);
    conv.participants.push(...toAdd);
    await conv.save();
    if (users.length) await createSystemMessage(conv, req.user._id, `${req.user.name} added ${users.map((u) => u.name).join(", ")}`);
    notifyChanged(conv.participants, conv._id);
    res.json({ conversation: await chatRowFor(req.user, conv) });
});

router.patch("/:id/members/:userId", async (req, res) => {
    const conv = await loadGroupAsAdmin(req.user, req.params.id);
    const userId = assertObjectId(req.params.userId, "user id");
    const { admin } = parse(z.object({ admin: z.boolean() }), req.body);
    if (!conv.participants.some((p) => String(p) === userId)) throw notFound("Not a member of this group");
    conv.admins = admin
        ? [...new Set([...conv.admins.map(String), userId])]
        : conv.admins.filter((a) => String(a) !== userId);
    if (!conv.admins.length) throw badRequest("A group needs at least one admin");
    await conv.save();
    notifyChanged(conv.participants, conv._id);
    res.json({ conversation: await chatRowFor(req.user, conv) });
});

// Admins remove members; any member may remove themself (leave).
router.delete("/:id/members/:userId", async (req, res) => {
    const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
    const userId = assertObjectId(req.params.userId, "user id");
    if (conv.type !== "group") throw badRequest("Not a group conversation");
    const leaving = userId === String(req.user._id);
    if (!leaving && !isAdmin(conv, req.user._id)) throw forbidden("Only group admins can remove members");
    if (!conv.participants.some((p) => String(p) === userId)) throw notFound("Not a member of this group");
    const removed = await User.findById(userId, "name");
    const before = conv.participants.map(String);
    conv.participants = conv.participants.filter((p) => String(p) !== userId);
    conv.admins = conv.admins.filter((a) => String(a) !== userId);
    if (!conv.admins.length && conv.participants.length) conv.admins = [conv.participants[0]];
    await conv.save();
    await createSystemMessage(conv, req.user._id, leaving ? `${req.user.name} left` : `${req.user.name} removed ${removed?.name ?? "a member"}`);
    notifyChanged(conv.participants, conv._id);
    realtime.emitToUser(userId, "conversation-removed", { conversationId: String(conv._id) });
    res.json({ removed: true, members: before.length - 1 });
});

router.get("/:id/messages", async (req, res) => {
    const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
    const page = parse(pageSchema, req.query);
    if (!page.before) await markRead(req.user._id, { conversationId: conv._id });
    res.json(await listMessages(conv, req.user._id, page));
});

router.post("/:id/read", async (req, res) => {
    const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
    res.json({ messageIds: await markRead(req.user._id, { conversationId: conv._id }) });
});

router.post("/:id/messages", async (req, res) => {
    const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
    res.status(201).json({ message: await sendText(conv, req.user, req.body) });
});

const mediaRoute = (path, upload, type) =>
    router.post(path, uploadLimiter, upload, async (req, res) => {
        const conv = await loadConversationFor(req.user._id, assertObjectId(req.params.id, "conversation id"));
        res.status(201).json({ message: await sendMedia(conv, req.user, type, req.file, req.body) });
    });
mediaRoute("/:id/images", imageUpload, "image");
mediaRoute("/:id/audio", audioUpload, "audio");
mediaRoute("/:id/files", fileUpload, "file");

export default router;
