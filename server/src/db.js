import mongoose from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";

export async function connectDb() {
    try {
        await mongoose.connect(config.MONGOURL, { serverSelectionTimeoutMS: 10_000 });
        logger.info("MongoDB connected");
    } catch (err) {
        logger.fatal({ err: err.message }, "MongoDB connection failed");
        process.exit(1);
    }
}
