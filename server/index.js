import http from "node:http";
import mongoose from "mongoose";
import { createApp } from "./src/app.js";
import { config } from "./src/config.js";
import { connectDb } from "./src/db.js";
import { logger } from "./src/logger.js";
import { storage } from "./src/services/storage.js";
import { attachSocket } from "./src/socket/index.js";

process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));

await storage.init();
await connectDb();

const server = http.createServer(createApp());
const io = attachSocket(server);

server.listen(config.PORT, () => logger.info({ port: config.PORT }, "Server is running"));

let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    io.close();
    server.close();
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
