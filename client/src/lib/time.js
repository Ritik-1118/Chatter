// Calendar-aware labels in the viewer's local time zone.
const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = (date, now) => Math.round((startOfDay(now) - startOfDay(date)) / DAY);

const toDate = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

export const formatClock = (value) => {
    const d = toDate(value);
    return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};

// Chat list / bubble label: "9:05 AM", "Yesterday", "Monday", "30/09/2026".
export function calculateTime(value, now = new Date()) {
    const date = toDate(value);
    if (!date) return "";
    const diff = daysAgo(date, now);
    if (diff <= 0) return formatClock(date);
    if (diff === 1) return "Yesterday";
    if (diff < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Separator between messages from different days.
export function dayLabel(value, now = new Date()) {
    const date = toDate(value);
    if (!date) return "";
    const diff = daysAgo(date, now);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function lastSeenLabel(value, now = new Date()) {
    const date = toDate(value);
    if (!date) return "offline";
    const diff = daysAgo(date, now);
    if (diff <= 0) return `last seen today at ${formatClock(date)}`;
    if (diff === 1) return `last seen yesterday at ${formatClock(date)}`;
    return `last seen ${calculateTime(date, now)}`;
}

export const isSameDay = (a, b) => {
    const x = toDate(a);
    const y = toDate(b);
    return Boolean(x && y && startOfDay(x).getTime() === startOfDay(y).getTime());
};
