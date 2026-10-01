import pino from "pino";
import { config } from "./config.js";

// Structured logs. Never log emails, tokens or message contents.
export const logger = pino({
    level: config.LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie"],
});
