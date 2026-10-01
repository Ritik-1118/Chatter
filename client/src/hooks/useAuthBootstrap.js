import { onAuthStateChanged } from "@firebase/auth";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { reducerCases } from "@/context/constants";
import { api } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { toUserInfo } from "@/lib/session";

// Restores the session on page load. Returns { error, retry } so the UI can
// show a recoverable error instead of an endless skeleton.
export default function useAuthBootstrap(dispatch, userInfo) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);
    const hasUser = Boolean(userInfo?.id);

    useEffect(() => {
        const auth = firebaseAuth();
        if (!auth) return undefined;
        let cancelled = false;
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (cancelled) return;
            if (!fbUser) {
                router.replace("/login");
                return;
            }
            if (hasUser) return;
            try {
                setError(null);
                const data = await api.checkUser();
                if (cancelled) return;
                if (!data.status) {
                    dispatch({ type: reducerCases.SET_NEW_USER, newUser: true });
                    dispatch({
                        type: reducerCases.SET_USER_INFO,
                        userInfo: { name: fbUser.displayName || "", email: fbUser.email, profilePicture: "/default_avatar.png" },
                    });
                    router.replace("/onboarding");
                    return;
                }
                dispatch({ type: reducerCases.SET_USER_INFO, userInfo: toUserInfo(data.data) });
            } catch (err) {
                if (!cancelled) setError(err.message || "Could not reach the server");
            }
        });
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [dispatch, hasUser, router, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return { error, retry };
}
