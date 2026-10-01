import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const keyGenerator = (req) => req.auth?.uid || ipKeyGenerator(req.ip);
const handler = (_req, res) => res.status(429).json({ error: { code: "rate_limited", message: "Too many requests, slow down" } });

export const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    handler,
});

export const uploadLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_UPLOAD_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    handler,
});
