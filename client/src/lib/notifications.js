// Browser notifications for background messages and calls.
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function showNotification(title, { body, icon, tag, onClick } = {}) {
    if (!notificationsSupported() || Notification.permission !== "granted") return null;
    try {
        const n = new Notification(title, { body, icon: icon || "/favicon.png", tag });
        n.onclick = () => {
            window.focus();
            onClick?.();
            n.close();
        };
        return n;
    } catch {
        return null;
    }
}

let ringtone = null;
export function startRingtone() {
    if (typeof Audio === "undefined") return;
    stopRingtone();
    ringtone = new Audio("/call-sound.mp3");
    ringtone.loop = true;
    ringtone.play().catch(() => {});
}
export function stopRingtone() {
    if (!ringtone) return;
    ringtone.pause();
    ringtone = null;
}
