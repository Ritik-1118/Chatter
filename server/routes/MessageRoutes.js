import { Router } from "express";
import { addMessage, getMessages,addImageMessage,addAudioMessage, getInitialContactsWithMessages } from "../controllers/MessageController.js";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";

const router = Router();

const imageStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, "uploads/images"),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		cb(null, `${Date.now()}-${randomUUID()}${ext}`);
	},
});
const audioStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, "uploads/recordings"),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		cb(null, `${Date.now()}-${randomUUID()}${ext}`);
	},
});

const imageFileFilter = (req, file, cb) => {
	const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowed.includes(ext)) return cb(null, true);
	return cb(new Error("Invalid image type"));
};
const audioFileFilter = (req, file, cb) => {
	const allowed = [".mp3", ".wav", ".ogg", ".m4a", ".webm"];
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowed.includes(ext)) return cb(null, true);
	return cb(new Error("Invalid audio type"));
};

const uploadAudio = multer({ storage: audioStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: audioFileFilter });
const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

const msgLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

router.post("/add-message", msgLimiter, addMessage);
router.get("/get-messages/:from/:to",getMessages);
router.post("/add-image-message", uploadLimiter, uploadImage.single("image"),addImageMessage);
router.post("/add-audio-message", uploadLimiter, uploadAudio.single("audio"),addAudioMessage);
router.get("/get-initial-contacts/:from",getInitialContactsWithMessages);

export default router;