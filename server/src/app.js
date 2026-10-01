import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pinoHttp } from "pino-http";
import { z } from "zod";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { logger } from "./logger.js";
import { authenticate, requireProfile } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import mediaRoutes from "./routes/media.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";
import { linkPreview } from "./services/linkPreview.js";
import { parse } from "./validate.js";

export const corsOrigin = (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin));

export function createApp() {
    const app = express();
    app.set("trust proxy", config.TRUST_PROXY);
    app.disable("x-powered-by");

    app.use(
        pinoHttp({
            logger,
            autoLogging: { ignore: (req) => req.url === "/health" },
            customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
            serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url.split("?")[0] }) },
        }),
    );
    // Media is embedded by the web client from another origin.
    app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    app.use(cors({ origin: corsOrigin, credentials: true }));

    app.get("/health", (_req, res) => {
        const up = mongoose.connection.readyState === 1;
        res.status(up ? 200 : 503).json({ status: up ? "ok" : "degraded", db: up ? "up" : "down" });
    });

    app.use(mediaRoutes);
    app.use(express.json({ limit: "3mb" }));

    app.use("/api", authenticate, apiLimiter);
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/conversations", conversationRoutes);
    app.use("/api/messages", messageRoutes);
    app.get("/api/link-preview", requireProfile, async (req, res) => {
        const { url } = parse(z.object({ url: z.url({ protocol: /^https?$/ }).max(2048) }), req.query);
        res.json({ preview: await linkPreview(url) });
    });

    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
