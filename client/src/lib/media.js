import { API_HOST } from "./config";

// Server-hosted paths (/uploads/...) live on the API origin; bundled assets on ours.
export function assetUrl(path) {
    if (!path) return "/default_avatar.png";
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    if (path.startsWith("/uploads/")) return `${API_HOST}${path}`;
    return path;
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const LIMITS = { image: 5 * 1024 * 1024, file: 20 * 1024 * 1024 };

// Downscales an image file and returns a JPEG/WebP data URL (used for avatars).
export function resizeImage(file, size = 512, type = "image/jpeg", quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the image"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("That file is not a supported image"));
            img.onload = () => {
                const scale = Math.min(1, size / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL(type, quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// Picks a MediaRecorder format this browser supports, with the matching file extension.
export function pickRecordingFormat() {
    const candidates = [
        ["audio/webm;codecs=opus", "webm"],
        ["audio/webm", "webm"],
        ["audio/ogg;codecs=opus", "ogg"],
        ["audio/mp4", "m4a"],
    ];
    if (typeof MediaRecorder === "undefined") return null;
    for (const [mimeType, ext] of candidates) {
        if (MediaRecorder.isTypeSupported?.(mimeType)) return { mimeType, ext, type: mimeType.split(";")[0] };
    }
    return { mimeType: "", ext: "webm", type: "audio/webm" };
}
