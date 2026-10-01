import fs from "node:fs";
import { Router } from "express";
import { HttpError, notFound } from "../errors.js";
import { findUserForIdentity } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { verifyIdToken } from "../services/firebase.js";
import { storage, verifyMediaSignature } from "../services/storage.js";

const router = Router();
const PRIVATE_KINDS = new Set(["images", "recordings", "files"]);

async function bearerUser(req) {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) return null;
    try {
        return await findUserForIdentity(await verifyIdToken(token));
    } catch {
        return null;
    }
}

// Avatars are public. Message media requires a valid signed URL or a bearer token
// belonging to a member of the conversation the media was sent in.
router.get("/uploads/:kind/:name", async (req, res) => {
    const { kind, name } = req.params;
    const key = `${kind}/${name}`;
    let filePath;
    try {
        filePath = storage.filePath(key);
    } catch {
        throw notFound();
    }

    let message = null;
    if (PRIVATE_KINDS.has(kind)) {
        message = await Message.findOne({ message: `uploads/${key}`, deletedAt: null }, "conversation file");
        if (!message) throw notFound();
        if (!verifyMediaSignature(key, req.query.exp, req.query.sig)) {
            const user = await bearerUser(req);
            if (!user) throw new HttpError(401, "unauthenticated", "Media requires a signed URL or a bearer token");
            const member = await Conversation.exists({ _id: message.conversation, participants: user._id });
            if (!member) throw new HttpError(403, "forbidden", "You cannot access this media");
        }
    } else if (kind !== "avatars") {
        throw notFound();
    }

    if (!fs.existsSync(filePath)) throw notFound();
    if (kind === "files") res.attachment(message?.file?.name || name);
    res.set("Cache-Control", kind === "avatars" ? "public, max-age=86400" : "private, max-age=3600");
    res.sendFile(filePath);
});

export default router;
