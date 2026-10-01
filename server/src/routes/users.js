import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound } from "../errors.js";
import { requireProfile } from "../middleware/auth.js";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { presence } from "../services/presence.js";
import { realtime } from "../services/realtime.js";
import { assertObjectId, parse } from "../validate.js";

const router = Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchSchema = z.object({
    q: z.string().trim().max(50).optional().default(""),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

router.get("/", requireProfile, async (req, res) => {
    const { q, limit, offset } = parse(searchSchema, req.query);
    const filter = { _id: { $ne: req.user._id }, deletedAt: null, blockedUsers: { $ne: req.user._id } };
    if (q) filter.name = { $regex: escapeRegex(q), $options: "i" };
    const users = await User.find(filter, "name about profilePicture").sort({ name: 1, _id: 1 }).skip(offset).limit(limit + 1);
    res.json({ users: users.slice(0, limit).map((u) => u.toPublic()), hasMore: users.length > limit });
});

router.get("/:id", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    const user = await User.findOne({ _id: id, deletedAt: null }, "name about profilePicture lastSeen blockedUsers");
    if (!user || user.blockedUsers.some((b) => String(b) === String(req.user._id))) throw notFound("User not found");
    res.json({
        user: {
            ...user.toPublic(),
            lastSeen: user.lastSeen,
            online: presence.isOnline(String(user._id)),
            blocked: req.user.blockedUsers.some((b) => String(b) === id),
        },
    });
});

router.post("/:id/block", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    if (id === String(req.user._id)) throw badRequest("You cannot block yourself");
    await User.updateOne({ _id: req.user._id }, { $addToSet: { blockedUsers: id } });
    realtime.emitToUser(req.user._id, "block-updated", { userId: id, blocked: true });
    res.json({ blocked: true });
});

router.delete("/:id/block", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    await User.updateOne({ _id: req.user._id }, { $pull: { blockedUsers: id } });
    realtime.emitToUser(req.user._id, "block-updated", { userId: id, blocked: false });
    res.json({ blocked: false });
});

router.post("/:id/report", requireProfile, async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    const { reason } = parse(z.object({ reason: z.string().trim().max(500).optional().default("") }), req.body);
    if (!(await User.exists({ _id: id }))) throw notFound("User not found");
    await Report.create({ reporter: req.user._id, reported: id, reason });
    res.status(201).json({ reported: true });
});

export default router;
