import crypto from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "https://chatter-web.vercel.app",
    "https://chatapp-dun-nine.vercel.app",
    "https://chatter-beta-two.vercel.app",
    "https://chatter-0.vercel.app",
].join(",");

const required = (name) => z.string({ error: `${name} is required` }).min(1, `${name} is required`);
const int = (fallback) => z.coerce.number().int().positive().default(fallback);

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: int(8000),
    MONGOURL: required("MONGOURL"),
    CLIENT_ORIGINS: z.string().default(DEFAULT_ORIGINS),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.string().default("info"),

    FIREBASE_PROJECT_ID: required("FIREBASE_PROJECT_ID"),
    FIREBASE_CLIENT_EMAIL: required("FIREBASE_CLIENT_EMAIL"),
    FIREBASE_PRIVATE_KEY: required("FIREBASE_PRIVATE_KEY"),

    ZEGO_APP_ID: z.coerce.number().int().positive().optional(),
    // ZEGO_SERVER_ID is the legacy name of the same secret.
    ZEGO_SERVER_SECRET: z.string().length(32).optional(),
    ZEGO_SERVER_ID: z.string().length(32).optional(),
    ZEGO_SERVER_URL: z.string().optional(),

    UPLOAD_DIR: z.string().default("uploads"),
    MEDIA_URL_SECRET: z.string().min(32).optional(),
    MEDIA_URL_TTL_SECONDS: int(6 * 60 * 60),

    RATE_LIMIT_WINDOW_MS: int(60_000),
    RATE_LIMIT_MAX: int(300),
    RATE_LIMIT_UPLOAD_MAX: int(30),
    SOCKET_EVENTS_PER_10S: int(60),

    MESSAGE_MAX_LENGTH: int(4000),
    MESSAGE_EDIT_WINDOW_MINUTES: int(15),
    MESSAGE_DELETE_WINDOW_MINUTES: int(60),
    CALL_RING_TIMEOUT_SECONDS: int(30),
    GROUP_MAX_MEMBERS: int(256),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`Invalid server configuration:\n${problems}`);
    process.exit(1);
}
const env = parsed.data;

if (env.NODE_ENV === "production" && !env.MEDIA_URL_SECRET) {
    console.error("Invalid server configuration:\n  - MEDIA_URL_SECRET: required in production (>= 32 chars)");
    process.exit(1);
}

export const config = {
    ...env,
    isProduction: env.NODE_ENV === "production",
    clientOrigins: env.CLIENT_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    uploadDir: path.resolve(process.cwd(), env.UPLOAD_DIR),
    // Without a configured secret, signed media URLs are valid until the process restarts.
    mediaUrlSecret: env.MEDIA_URL_SECRET || crypto.randomBytes(32).toString("hex"),
    zego: {
        appId: env.ZEGO_APP_ID,
        secret: env.ZEGO_SERVER_SECRET || env.ZEGO_SERVER_ID,
        serverUrl: env.ZEGO_SERVER_URL,
    },
    firebase: {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
};
