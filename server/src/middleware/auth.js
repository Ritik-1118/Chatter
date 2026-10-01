import { HttpError } from "../errors.js";
import { User } from "../models/User.js";
import { verifyIdToken } from "../services/firebase.js";

// Finds the profile for a verified Firebase identity, linking legacy (email-only) records.
export async function findUserForIdentity({ uid, email }) {
    let user = await User.findOne({ firebaseUid: uid, deletedAt: null });
    if (!user) {
        user = await User.findOne({ email, deletedAt: null, firebaseUid: { $in: [null, undefined] } });
        if (user) {
            user.firebaseUid = uid;
            await user.save();
        }
    }
    return user;
}

// Verifies the bearer token. Sets req.auth = { uid, email } and req.user = profile | null.
export async function authenticate(req, _res, next) {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) return next(new HttpError(401, "unauthenticated", "Missing or invalid Authorization header"));
    try {
        req.auth = await verifyIdToken(token);
    } catch {
        return next(new HttpError(401, "unauthenticated", "Invalid or expired token"));
    }
    req.user = await findUserForIdentity(req.auth);
    next();
}

export function requireProfile(req, _res, next) {
    if (!req.user) return next(new HttpError(403, "not_onboarded", "Create your profile first"));
    next();
}
