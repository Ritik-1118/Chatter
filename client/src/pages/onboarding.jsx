import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import AvatarPicker from "@/components/common/AvatarPicker";
import Input from "@/components/common/Input";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { api } from "@/lib/api";
import { toUserInfo } from "@/lib/session";

export default function Onboarding() {
    const router = useRouter();
    const [{ userInfo, newUser }, dispatch] = useStateProvider();
    const [name, setName] = useState(userInfo?.name || "");
    const [about, setAbout] = useState("");
    const [image, setImage] = useState("/default_avatar.png");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const headingRef = useRef(null);

    useEffect(() => {
        if (!newUser) router.replace(userInfo?.id ? "/" : "/login");
    }, [newUser, userInfo, router]);
    useEffect(() => headingRef.current?.focus(), []);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (name.trim().length < 3) return setError("Display name must be at least 3 characters.");
        setLoading(true);
        try {
            const data = await api.onboard({ name: name.trim(), about: about.trim(), image });
            // Setting the user and clearing newUser triggers the single redirect above.
            dispatch({ type: reducerCases.SET_USER_INFO, userInfo: toUserInfo(data.user) });
            dispatch({ type: reducerCases.SET_NEW_USER, newUser: false });
        } catch (err) {
            setError(err.message || "Could not create profile. Please try again.");
            setLoading(false);
        }
    };

    return (
        <AuthLayout wide busy={loading}>
            <h1 ref={headingRef} tabIndex={-1} className="mb-1 text-2xl font-semibold text-light-primary-text outline-none dark:text-dark-primary-text">
                Create your profile
            </h1>
            <p className="mb-6 text-light-secondary-text dark:text-dark-secondary-text">Let others know who you are!</p>
            {error && (
                <div className="mb-4 w-full rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-900 dark:text-red-100" role="alert">
                    {error}
                </div>
            )}
            <form
                onSubmit={submit}
                className="flex w-full flex-col overflow-hidden rounded-3xl border border-light-divider bg-light-secondary-background shadow-2xl dark:border-dark-divider dark:bg-dark-secondary-background md:flex-row"
            >
                <div className="flex flex-col items-center justify-center gap-4 border-light-divider bg-light-surface px-8 py-10 dark:border-dark-divider dark:bg-dark-surface md:w-1/2 md:border-r">
                    <AvatarPicker image={image} setImage={setImage} onError={setError} />
                    <span className="text-light-secondary-text dark:text-dark-secondary-text">Choose your avatar</span>
                </div>
                <div className="flex flex-col justify-center gap-6 px-8 py-10 md:w-1/2">
                    <Input name="Display Name" state={name} setState={setName} label required maxLength={50} />
                    <Input name="About" state={about} setState={setAbout} label maxLength={140} />
                    <button
                        type="submit"
                        disabled={loading}
                        aria-label="Create profile"
                        className="w-full rounded-xl bg-light-accent px-6 py-3 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80 dark:bg-dark-accent dark:text-dark-surface"
                    >
                        {loading ? "Creating profile…" : "Create Profile"}
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}
