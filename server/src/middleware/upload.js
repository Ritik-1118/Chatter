import multer from "multer";
import { LIMITS } from "../services/media.js";

// Files stay in memory until validated, so rejected uploads never touch the disk.
const memory = (fileSize) => multer({ storage: multer.memoryStorage(), limits: { fileSize, files: 1 } });

export const imageUpload = memory(LIMITS.image).single("image");
export const audioUpload = memory(LIMITS.audio).single("audio");
export const fileUpload = memory(LIMITS.file).single("file");
export const avatarUpload = memory(LIMITS.avatar).single("avatar");
