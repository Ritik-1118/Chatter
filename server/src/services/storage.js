import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

// Local-disk storage. Keys look like "images/<uuid>.png" and are exposed to clients
// as "uploads/<key>" (the URL path they are served from).
// Swap this module for an object-storage adapter with the same interface if needed.
const root = config.uploadDir;
export const MEDIA_KINDS = ["images", "recordings", "files", "avatars"];

export const keyToPath = (key) => `uploads/${key}`;
export const pathToKey = (p) => (typeof p === "string" && p.startsWith("uploads/") ? p.slice("uploads/".length) : null);

function resolveKey(key) {
    const [kind, name, ...rest] = String(key).split("/");
    if (!MEDIA_KINDS.includes(kind) || !name || rest.length || !/^[\w.-]+$/.test(name) || name.startsWith(".")) {
        throw new Error("invalid storage key");
    }
    return path.join(root, kind, name);
}

export const storage = {
    async init() {
        await Promise.all(MEDIA_KINDS.map((k) => fs.mkdir(path.join(root, k), { recursive: true })));
    },
    async put(kind, ext, buffer) {
        const key = `${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        await fs.writeFile(resolveKey(key), buffer);
        return key;
    },
    async remove(key) {
        try {
            await fs.unlink(resolveKey(key));
        } catch {
            /* already gone */
        }
    },
    filePath: resolveKey,
};

const sign = (key, exp) => crypto.createHmac("sha256", config.mediaUrlSecret).update(`${key}:${exp}`).digest("base64url");

// A time-limited capability URL, usable directly in <img>/<audio> tags.
export function signedMediaPath(key) {
    const exp = Math.floor(Date.now() / 1000) + config.MEDIA_URL_TTL_SECONDS;
    return `/${keyToPath(key)}?exp=${exp}&sig=${sign(key, exp)}`;
}

export function verifyMediaSignature(key, exp, sig) {
    const expNum = Number(exp);
    if (!sig || !Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
    const expected = Buffer.from(sign(key, expNum));
    const given = Buffer.from(String(sig));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
