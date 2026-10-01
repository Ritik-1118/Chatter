export default function ConnectionBanner({ status }) {
    if (status === "connected" || status === "connecting") return null;
    const text = status === "reconnecting" ? "Reconnecting…" : "You're offline. Messages will be sent when you're back online.";
    return (
        <div role="status" className="fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-sm font-medium text-black shadow">
            {text}
        </div>
    );
}
