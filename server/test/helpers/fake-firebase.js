// Preloaded into the server process under test (`node --import`).
// Replaces Firebase ID-token verification so tests can authenticate without a
// real Firebase project. Everything else in the server runs unmodified.
//
// Token format: "test:<uid>:<email>"
import { Auth } from "firebase-admin/auth";

Auth.prototype.verifyIdToken = async function verifyIdToken(token) {
    if (typeof token !== "string" || !token.startsWith("test:")) {
        throw new Error("fake-firebase: invalid token");
    }
    const [, uid, email] = token.split(":");
    if (!uid || !email) throw new Error("fake-firebase: malformed token");
    return { uid, email };
};
