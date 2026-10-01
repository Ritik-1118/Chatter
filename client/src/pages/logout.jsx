import { useRouter } from "next/router";
import { useEffect } from "react";
import { useStateProvider } from "@/context/StateContext";
import { endSession } from "@/lib/session";

// Safe to open directly (bookmark / refresh): it never assumes a live socket.
export default function Logout() {
    const [, dispatch] = useStateProvider();
    const router = useRouter();

    useEffect(() => {
        endSession(dispatch).finally(() => router.replace("/login"));
    }, [dispatch, router]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-light-background text-light-secondary-text dark:bg-dark-background dark:text-dark-secondary-text">
            <p role="status">Signing out…</p>
        </main>
    );
}
