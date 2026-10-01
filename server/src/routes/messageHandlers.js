// Shared request handlers for creating messages (used by the conversation and legacy routes).
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createMessage } from "../services/messages.js";
import { processAudio, processFile, processImage, sanitizeFileName } from "../services/media.js";
import { keyToPath, storage } from "../services/storage.js";
import { objectId, parse } from "../validate.js";

export const textSchema = z.object({
    message: z
        .string({ error: "message must be a string" })
        .trim()
        .min(1, "message cannot be empty")
        .max(config.MESSAGE_MAX_LENGTH, `message must be at most ${config.MESSAGE_MAX_LENGTH} characters`),
    replyTo: objectId("replyTo").optional().nullable(),
    tempId: z.string().max(64).optional(),
});

export const mediaMetaSchema = z.object({
    replyTo: objectId("replyTo").optional().nullable(),
    tempId: z.string().max(64).optional(),
});

export async function sendText(conv, user, body) {
    const { message, replyTo, tempId } = parse(textSchema, body);
    return createMessage({ conv, senderId: user._id, type: "text", message, replyToId: replyTo, tempId });
}

const PROCESSORS = {
    image: { kind: "images", run: (f) => processImage(f.buffer) },
    audio: { kind: "recordings", run: (f) => processAudio(f.buffer, f.mimetype) },
    file: { kind: "files", run: (f) => processFile(f.buffer, f.originalname) },
};

// Validates and stores the uploaded file only after all request checks have passed.
export async function sendMedia(conv, user, type, file, meta) {
    if (!file) throw new HttpError(400, "bad_upload", `${type === "file" ? "A file" : `An ${type}`} is required`);
    const { replyTo, tempId } = parse(mediaMetaSchema, meta);
    const { kind, run } = PROCESSORS[type];
    const processed = await run(file);
    const key = await storage.put(kind, processed.ext, processed.buffer);
    try {
        return await createMessage({
            conv,
            senderId: user._id,
            type,
            message: keyToPath(key),
            file:
                type === "file"
                    ? { name: sanitizeFileName(file.originalname), size: processed.buffer.length, mime: processed.mime }
                    : { name: sanitizeFileName(file.originalname), size: processed.buffer.length },
            replyToId: replyTo,
            tempId,
        });
    } catch (err) {
        await storage.remove(key);
        throw err;
    }
}
