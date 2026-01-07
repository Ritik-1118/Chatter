import { Router } from "express";
import { addMessage, getMessages, addImageMessage, addAudioMessage, getInitialContactsWithMessages } from "../controllers/MessageController.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const allowedImages = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"];

const imageStorage = multer.diskStorage({
	destination: "uploads/images",
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname || "");
		cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
	},
});

const audioStorage = multer.diskStorage({
	destination: "uploads/recordings",
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname || "");
		cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
	},
});

const uploadImage = multer({
	storage: imageStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (allowedImages.includes(file.mimetype)) return cb(null, true);
		return cb(new Error("Invalid image type"));
	},
});

const uploadAudio = multer({
	storage: audioStorage,
	limits: { fileSize: 12 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (allowedAudio.includes(file.mimetype)) return cb(null, true);
		return cb(new Error("Invalid audio type"));
	},
});

const router = Router();

router.post("/add-message",addMessage);
router.get("/get-messages/:from/:to",getMessages);
router.post("/add-image-message", uploadImage.single("image"), addImageMessage);
router.post("/add-audio-message", uploadAudio.single("audio"), addAudioMessage);
router.get("/get-initial-contacts/:from",getInitialContactsWithMessages);

export default router;