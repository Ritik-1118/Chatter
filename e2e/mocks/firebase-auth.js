// E2E shim for "firebase/auth". The signed-in identity lives in localStorage so
// each Playwright browser context can be a different user:
//   __e2e_user          -> currently signed-in user {uid, email, displayName, photoURL}
//   __e2e_pending_user  -> identity that the next signInWithPopup() will "choose"
// ID tokens use the format understood by server/test/helpers/fake-firebase.js.
const USER_KEY = "__e2e_user";
const PENDING_KEY = "__e2e_pending_user";
const listeners = new Set();

const read = (key) => {
    if (typeof window === "undefined") return null;
    try {
        return JSON.parse(window.localStorage.getItem(key));
    } catch {
        return null;
    }
};

const toUser = (u) =>
    u && {
        ...u,
        getIdToken: async () => `test:${u.uid}:${u.email}`,
    };

const auth = {
    get currentUser() {
        return toUser(read(USER_KEY));
    },
};

const notify = () => listeners.forEach((cb) => cb(auth.currentUser));

export const getAuth = () => auth;

export function onAuthStateChanged(_auth, cb) {
    listeners.add(cb);
    setTimeout(() => cb(auth.currentUser), 0);
    return () => listeners.delete(cb);
}

export class GoogleAuthProvider {}

export async function signInWithPopup() {
    const pending = read(PENDING_KEY);
    if (!pending) throw new Error("e2e: no pending user configured");
    window.localStorage.setItem(USER_KEY, JSON.stringify(pending));
    notify();
    return { user: auth.currentUser };
}

export async function signOut() {
    window.localStorage.removeItem(USER_KEY);
    notify();
}
