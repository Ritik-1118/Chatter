import Image from "next/image";

export default function Empty() {
    return (
        <section className="relative hidden h-screen w-full items-center justify-center overflow-hidden bg-light-background dark:bg-dark-background md:flex" aria-label="No chat selected">
            <div className="absolute inset-0 z-0 animate-gradient bg-light-accent opacity-20 blur-[3px] dark:bg-dark-accent" aria-hidden="true" />
            <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center">
                <Image src="/gifs/G1.gif" alt="" width={180} height={180} unoptimized className="rounded-full shadow-lg" />
                <span className="font-mono text-4xl font-extrabold tracking-wide text-light-accent dark:text-dark-accent">Chatter</span>
                <h2 className="text-2xl font-semibold text-light-primary-text dark:text-dark-primary-text">Welcome to Chatter!</h2>
                <p className="max-w-xl text-light-secondary-text dark:text-dark-secondary-text">
                    Select a chat to get started, or start a new conversation or group.
                </p>
            </div>
        </section>
    );
}
