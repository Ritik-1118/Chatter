import { getApp, getApps, initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let auth = null;

// Initialised lazily in the browser only, so builds and server rendering never need
// Firebase credentials.
export function firebaseAuth() {
    if (typeof window === "undefined") return null;
    if (!auth) {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
    }
    return auth;
}

// Always returns a valid (auto-refreshed) ID token, or null when signed out.
export async function getIdToken(forceRefresh = false) {
    const user = firebaseAuth()?.currentUser;
    return user ? user.getIdToken(forceRefresh) : null;
}
