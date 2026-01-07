import admin from "firebase-admin";
import dotenv from "dotenv";

// Initialize Firebase Admin SDK once per process.
// Relies on service account details provided via environment variables.
// FIREBASE_PRIVATE_KEY should preserve newlines as \n in .env.
dotenv.config();

let app;
if (!admin.apps.length) {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing Firebase Admin credentials env vars");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
} else {
  app = admin.app();
}

export const firebaseAdmin = admin;
export default app;
