import multer from "multer";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class HttpError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const badRequest = (message, details) => new HttpError(400, "bad_request", message, details);
export const forbidden = (message = "Forbidden") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new HttpError(404, "not_found", message);
export const conflict = (message) => new HttpError(409, "conflict", message);

export function notFoundHandler(req, _res, next) {
    next(new HttpError(404, "not_found", `No route for ${req.method} ${req.path}`));
}

// Maps every error to a JSON body of the form { error: { code, message } }.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
    let status = 500;
    let code = "internal_error";
    let message = "Something went wrong";
    let details;

    if (err instanceof HttpError) {
        ({ status, code, message, details } = err);
    } else if (err instanceof ZodError) {
        status = 400;
        code = "validation_error";
        message = err.issues[0]?.message || "Invalid request";
        details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    } else if (err instanceof multer.MulterError) {
        status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        code = err.code === "LIMIT_FILE_SIZE" ? "file_too_large" : "bad_upload";
        message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    } else if (err?.name === "CastError") {
        status = 400;
        code = "invalid_id";
        message = `Invalid value for ${err.path}`;
    } else if (err?.name === "ValidationError") {
        status = 400;
        code = "validation_error";
        message = err.message;
    } else if (err?.code === 11000) {
        status = 409;
        code = "conflict";
        message = "Resource already exists";
    } else if (err?.type === "entity.too.large") {
        status = 413;
        code = "payload_too_large";
        message = "Request body is too large";
    } else if (err?.type === "entity.parse.failed") {
        status = 400;
        code = "invalid_json";
        message = "Malformed JSON body";
    }

    if (status >= 500) logger.error({ err, reqId: req.id, path: req.path }, "request failed");
    res.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: req.id } });
}
