import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { HttpError } from "../errors.js";

export const LIMITS = {
    image: 5 * 1024 * 1024,
    audio: 12 * 1024 * 1024,
    file: 20 * 1024 * 1024,
    avatar: 5 * 1024 * 1024,
};

const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const AUDIO_TYPES = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/vnd.wave": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "video/mp4": "m4a",
};
const FILE_EXTS = new Set([
    "pdf",
    "zip",
    "docx",
    "xlsx",
    "pptx",
    "odt",
    "ods",
    "odp",
    "rtf",
    "7z",
    "rar",
    "gz",
    "epub",
    "mp4",
    "mov",
    "webm",
    "png",
    "jpg",
    "webp",
    "gif",
    "mp3",
    "m4a",
    "ogg",
    "wav",
]);
const TEXT_EXTS = new Set(["txt", "csv", "md", "json", "log"]);

const unsupported = (what) => new HttpError(415, "unsupported_media_type", `Unsupported ${what} type`);
const baseMime = (m) =>
    String(m || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
const isEbml = (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x1a45dfa3;

// Images are re-encoded to strip metadata (EXIF/GPS) and fix orientation.
export async function processImage(buffer) {
    const detected = await fileTypeFromBuffer(buffer);
    const ext = detected && IMAGE_TYPES[detected.mime];
    if (!ext) throw unsupported("image");
    if (ext === "gif") return { buffer, ext };
    try {
        return { buffer: await sharp(buffer).rotate().toBuffer(), ext };
    } catch {
        throw unsupported("image");
    }
}

// The real encoding wins over whatever the client claimed (MediaRecorder output is often mislabelled).
export async function processAudio(buffer, declaredMime) {
    const detected = await fileTypeFromBuffer(buffer);
    if (detected && AUDIO_TYPES[detected.mime]) return { buffer, ext: AUDIO_TYPES[detected.mime] };
    if (isEbml(buffer)) return { buffer, ext: "webm" };
    const ext = AUDIO_TYPES[baseMime(declaredMime)];
    if (!ext || detected) throw unsupported("audio");
    return { buffer, ext };
}

export async function processFile(buffer, originalName) {
    const nameExt = String(originalName || "")
        .split(".")
        .pop()
        .toLowerCase();
    const detected = await fileTypeFromBuffer(buffer);
    if (detected) {
        if (!FILE_EXTS.has(detected.ext)) throw unsupported("file");
        return { buffer, ext: detected.ext, mime: detected.mime };
    }
    if (TEXT_EXTS.has(nameExt) && !buffer.includes(0)) return { buffer, ext: nameExt, mime: "text/plain" };
    throw unsupported("file");
}

// Square 256px WebP avatar.
export async function processAvatar(buffer) {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !IMAGE_TYPES[detected.mime]) throw unsupported("image");
    try {
        const out = await sharp(buffer).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
        return { buffer: out, ext: "webp" };
    } catch {
        throw unsupported("image");
    }
}

const DATA_URL = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;
export function decodeDataUrl(value) {
    const match = DATA_URL.exec(value);
    if (!match) return null;
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > LIMITS.avatar) throw new HttpError(413, "file_too_large", "Image is too large");
    return buffer;
}

export const sanitizeFileName = (name) =>
    String(name || "file")
        .replace(/[^\w.\- ()]/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 120) || "file";
