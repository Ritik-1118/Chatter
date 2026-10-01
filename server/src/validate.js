import mongoose from "mongoose";
import { z } from "zod";
import { badRequest } from "./errors.js";

export const isObjectId = (v) => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v) && mongoose.isValidObjectId(v);

export const objectId = (label = "id") => z.string({ error: `${label} is required` }).refine(isObjectId, { message: `${label} must be a valid id` });

export const parse = (schema, value) => schema.parse(value ?? {});

export function assertObjectId(value, label = "id") {
    if (!isObjectId(value)) throw badRequest(`${label} must be a valid id`);
    return value;
}
