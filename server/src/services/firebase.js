import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "../config.js";

const app = getApps()[0] || initializeApp({ credential: cert(config.firebase) });

// Returns { uid, email } for a valid Firebase ID token, otherwise throws.
export async function verifyIdToken(token) {
    const decoded = await getAuth(app).verifyIdToken(token);
    if (!decoded?.uid || !decoded.email) throw new Error("token has no uid/email");
    return { uid: decoded.uid, email: decoded.email.toLowerCase() };
}
