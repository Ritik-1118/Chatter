import Image from "next/image";
import ThemeToggle from "./common/ThemeToggle";

// Shared frame for the login and onboarding pages.
export default function AuthLayout({ children, wide = false, busy = false }) {
    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-light-background dark:bg-dark-background">
            <ThemeToggle className="absolute right-6 top-6 z-20" withLabel />
            <div className="absolute inset-0 z-0 animate-gradient bg-light-accent opacity-20 blur-[3px] dark:bg-dark-accent" aria-hidden="true" />
            <main
                className={`relative z-10 mx-4 flex w-full flex-col items-center animate-fade-in ${wide ? "max-w-2xl" : "max-w-sm"}`}
                aria-busy={busy}
            >
                <div className="mb-4 flex flex-col items-center">
                    <Image
                        src="/gifs/G1.gif"
                        alt="Chatter logo"
                        width={80}
                        height={80}
                        unoptimized
                        className="rounded-full border-4 border-light-accent shadow-lg dark:border-dark-accent"
                    />
                    <span className="mt-3 font-mono text-4xl font-extrabold tracking-wide text-light-accent dark:text-dark-accent">Chatter</span>
                </div>
                {children}
            </main>
        </div>
    );
}
