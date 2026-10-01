import { GoogleAuthProvider, signInWithPopup } from "@firebase/auth";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import AuthLayout from "@/components/AuthLayout";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { api } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { toUserInfo } from "@/lib/session";

export default function Login() {
    const router = useRouter();
    const [{ userInfo, newUser }, dispatch] = useStateProvider();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const headingRef = useRef(null);

    useEffect(() => headingRef.current?.focus(), []);
    useEffect(() => {
        if (userInfo?.id && !newUser) router.replace("/");
    }, [userInfo, newUser, router]);

    const handleLogin = async () => {
        setError("");
        setLoading(true);
        try {
            const { user } = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
            const data = await api.checkUser();
            if (data.status) {
                dispatch({ type: reducerCases.SET_NEW_USER, newUser: false });
                dispatch({ type: reducerCases.SET_USER_INFO, userInfo: toUserInfo(data.data) });
            } else {
                dispatch({ type: reducerCases.SET_NEW_USER, newUser: true });
                dispatch({
                    type: reducerCases.SET_USER_INFO,
                    userInfo: { name: user.displayName || "", email: user.email, profilePicture: "/default_avatar.png" },
                });
                router.push("/onboarding");
            }
        } catch (err) {
            setError(err?.code === "auth/popup-closed-by-user" ? "Sign-in was cancelled." : "Google sign-in failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout busy={loading}>
            <div className="w-full rounded-2xl border border-light-divider bg-light-secondary-background px-8 py-10 text-light-primary-text shadow-2xl dark:border-dark-divider dark:bg-dark-secondary-background dark:text-dark-primary-text">
                {error && (
                    <div className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-900 dark:text-red-100" role="alert">
                        {error}
                    </div>
                )}
                <div className="mb-6 text-center">
                    <h1 ref={headingRef} tabIndex={-1} className="mb-2 text-2xl font-bold outline-none md:text-3xl">
                        Welcome back!
                    </h1>
                    <p className="text-light-secondary-text dark:text-dark-secondary-text">Sign in to continue to your chats</p>
                </div>
                <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading}
                    aria-label="Sign in with Google"
                    className="flex w-full items-center justify-center gap-4 rounded-xl border border-light-accent bg-light-accent px-5 py-3 font-semibold text-white shadow-xl transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80 dark:border-dark-accent dark:bg-dark-accent dark:text-dark-surface"
                >
                    <FcGoogle className="rounded-full bg-white text-2xl" aria-hidden="true" />
                    {loading ? "Signing in…" : "Continue with Google"}
                </button>
            </div>
        </AuthLayout>
    );
}
