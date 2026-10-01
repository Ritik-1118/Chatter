import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { conflict, forbidden, HttpError } from "../errors.js";
import { requireProfile } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { avatarUpload } from "../middleware/upload.js";
import { Conversation } from "../models/Conversation.js";
import { User } from "../models/User.js";
import { removeStoredAvatar, resolveAvatar, storeAvatar } from "../services/avatars.js";
import { createSystemMessage } from "../services/messages.js";
import { realtime } from "../services/realtime.js";
import { generateToken04 } from "../utils/zegoToken.js";
import { parse } from "../validate.js";

const router = Router();

const name = z
    .string({ error: "Display name is required" })
    .trim()
    .min(3, "Display name must be 3-50 characters")
    .max(50, "Display name must be 3-50 characters");
const about = z.string().trim().max(140, "About must be at most 140 characters");

const onboardSchema = z.object({ name, about: about.optional().default(""), image: z.string().optional() });
const profileSchema = z.object({ name: name.optional(), about: about.optional(), image: z.string().optional() });

async function notifyContacts(user) {
    const convs = await Conversation.find({ participants: user._id }, "participants").lean();
    const ids = convs.flatMap((c) => c.participants.map(String));
    realtime.emitToUsers(ids, "profile-updated", user.toPublic());
}

router.post("/check-user", async (req, res) => {
    if (!req.user) return res.json({ status: false, msg: "User not found" });
    res.json({ status: true, msg: "User Found!", data: req.user.toSelf() });
});

router.post("/onboard-user", async (req, res) => {
    if (req.user) throw conflict("A profile already exists for this account");
    const body = parse(onboardSchema, req.body);
    const profilePicture = (await resolveAvatar(body.image)) ?? "/default_avatar.png";
    const user = await User.create({
        firebaseUid: req.auth.uid,
        email: req.auth.email,
        name: body.name,
        about: body.about,
        profilePicture,
    });
    res.json({ status: true, msg: "Success", user: user.toSelf() });
});

router.patch("/profile", requireProfile, async (req, res) => {
    const body = parse(profileSchema, req.body);
    const user = req.user;
    if (body.name !== undefined) user.name = body.name;
    if (body.about !== undefined) user.about = body.about;
    if (body.image !== undefined) {
        const next = await resolveAvatar(body.image);
        if (next && next !== user.profilePicture) {
            await removeStoredAvatar(user.profilePicture);
            user.profilePicture = next;
        }
    }
    await user.save();
    await notifyContacts(user);
    res.json({ user: user.toSelf() });
});

router.post("/avatar", requireProfile, uploadLimiter, avatarUpload, async (req, res) => {
    if (!req.file) throw new HttpError(400, "bad_upload", "avatar file is required");
    const next = await storeAvatar(req.file.buffer);
    await removeStoredAvatar(req.user.profilePicture);
    req.user.profilePicture = next;
    await req.user.save();
    await notifyContacts(req.user);
    res.json({ user: req.user.toSelf() });
});

// Removes personal data; past messages remain attributed to "Deleted user".
router.delete("/account", requireProfile, async (req, res) => {
    const user = req.user;
    const groups = await Conversation.find({ type: "group", participants: user._id });
    for (const conv of groups) {
        await createSystemMessage(conv, user._id, `${user.name} left`);
        conv.participants = conv.participants.filter((p) => String(p) !== String(user._id));
        conv.admins = conv.admins.filter((a) => String(a) !== String(user._id));
        if (!conv.admins.length && conv.participants.length) conv.admins = [conv.participants[0]];
        await conv.save();
        realtime.emitToUsers(conv.participants, "conversation-updated", { conversationId: String(conv._id) });
    }
    await removeStoredAvatar(user.profilePicture);
    user.deletedAt = new Date();
    user.firebaseUid = undefined;
    user.email = `deleted-${user._id}@deleted.invalid`;
    user.name = "Deleted user";
    user.about = "";
    user.profilePicture = "/default_avatar.png";
    user.blockedUsers = [];
    await user.save();
    realtime.emitToUser(user._id, "account-deleted", {});
    res.status(204).end();
});

router.get("/get-contacts", requireProfile, async (req, res) => {
    const users = await User.find({
        _id: { $ne: req.user._id },
        deletedAt: null,
        blockedUsers: { $ne: req.user._id },
    })
        .sort({ name: 1 })
        .limit(1000)
        .select("name about profilePicture");
    const grouped = {};
    for (const u of users) {
        const letter = (u.name || "#").charAt(0).toUpperCase();
        (grouped[letter] ??= []).push(u.toPublic());
    }
    res.json({ users: grouped });
});

function callToken(req, res) {
    if (req.params.userId && req.params.userId !== String(req.user._id)) {
        throw forbidden("Call tokens can only be issued for yourself");
    }
    const { appId, secret, serverUrl } = config.zego;
    if (!appId || !secret) throw new HttpError(503, "calls_unavailable", "Calling is not configured on this server");
    const token = generateToken04(appId, String(req.user._id), secret, 3600);
    res.json({ token, appId, serverUrl: serverUrl || null });
}
router.get("/generate-token", requireProfile, callToken);
router.get("/generate-token/:userId", requireProfile, callToken);

export default router;
