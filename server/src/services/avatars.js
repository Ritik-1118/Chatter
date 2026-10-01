import { badRequest } from "../errors.js";
import { decodeDataUrl, processAvatar } from "./media.js";
import { pathToKey, storage } from "./storage.js";

const PRESET = /^\/(avatars\/[1-9]\.png|default_avatar\.png|group_avatar\.svg)$/;

// Accepts a bundled preset path or an image data URL; returns the value to store.
export async function resolveAvatar(image) {
    if (image === undefined || image === null || image === "") return undefined;
    if (typeof image !== "string") throw badRequest("image must be a string");
    if (PRESET.test(image)) return image;
    const buffer = decodeDataUrl(image);
    if (!buffer) throw badRequest("image must be a preset avatar or an image data URL");
    return storeAvatar(buffer);
}

export async function storeAvatar(buffer) {
    const { buffer: out, ext } = await processAvatar(buffer);
    return `/${"uploads/"}${await storage.put("avatars", ext, out)}`;
}

export async function removeStoredAvatar(value) {
    const key = pathToKey(String(value || "").replace(/^\//, ""));
    if (key?.startsWith("avatars/")) await storage.remove(key);
}
