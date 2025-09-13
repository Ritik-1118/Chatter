import admin from "firebase-admin";

// Initialize Firebase Admin SDK using service account details from environment variables
// Expected env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// Note: PRIVATE KEY may contain escaped newlines; replace them.
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey && privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Initialize with default credentials if available (e.g., GCP runtime)
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } catch (_e) {
      // Will fail to verify tokens until credentials are provided
    }
  }
}

export default admin;
