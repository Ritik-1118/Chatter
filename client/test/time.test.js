import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateTime, dayLabel, lastSeenLabel } from "@/lib/time";

// Most users are not on UTC; the app's author is in IST (UTC+05:30).
process.env.TZ = "Asia/Kolkata";

const at = (iso) => new Date(iso);

describe("calculateTime", () => {
    afterEach(() => vi.useRealTimers());
    const now = (iso) => {
        vi.useFakeTimers();
        vi.setSystemTime(at(iso));
    };

    it("shows a clock time for a message sent earlier today", () => {
        now("2026-09-15T18:00:00+05:30");
        expect(calculateTime("2026-09-15T09:05:00+05:30")).toBe("9:05 AM");
    });

    it("shows 'Yesterday' mid-month", () => {
        now("2026-09-15T18:00:00+05:30");
        expect(calculateTime("2026-09-14T12:00:00+05:30")).toBe("Yesterday");
    });

    it("shows the weekday for messages 2-6 days old", () => {
        now("2026-09-15T18:00:00+05:30"); // Tuesday
        expect(calculateTime("2026-09-11T12:00:00+05:30")).toBe("Friday");
    });

    it("shows the full date for messages a week or more old", () => {
        now("2026-09-15T18:00:00+05:30");
        expect(calculateTime("2026-09-01T12:00:00+05:30")).toBe("01/09/2026");
    });

    it("[B-C15] shows 'Yesterday' (not a clock time) for 11 PM yesterday, viewed at 1 AM local", () => {
        now("2026-09-16T01:00:00+05:30");
        expect(calculateTime("2026-09-15T23:00:00+05:30")).toBe("Yesterday");
    });

    it("[B-C15] shows 'Yesterday' on the 1st of the month", () => {
        now("2026-10-01T18:00:00+05:30");
        expect(calculateTime("2026-09-30T12:00:00+05:30")).toBe("Yesterday");
    });

    it("[B-C15] shows a weekday (not a full date) for a message two calendar days ago but < 48h old", () => {
        now("2026-09-16T01:00:00+05:30"); // Wednesday 01:00
        expect(calculateTime("2026-09-14T23:00:00+05:30")).toBe("Monday");
    });

    it("[B-C15] handles a missing or invalid timestamp gracefully", () => {
        expect(calculateTime(undefined)).toBe("");
        expect(calculateTime("not a date")).toBe("");
    });
});

describe("dayLabel / lastSeenLabel", () => {
    afterEach(() => vi.useRealTimers());

    it("labels day separators", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-15T18:00:00+05:30"));
        expect(dayLabel("2026-09-15T08:00:00+05:30")).toBe("Today");
        expect(dayLabel("2026-09-14T08:00:00+05:30")).toBe("Yesterday");
        expect(dayLabel("2026-08-01T08:00:00+05:30")).toBe("1 August 2026");
    });

    it("describes last seen", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-15T18:00:00+05:30"));
        expect(lastSeenLabel("2026-09-15T09:30:00+05:30")).toBe("last seen today at 9:30 AM");
        expect(lastSeenLabel("2026-09-14T09:30:00+05:30")).toBe("last seen yesterday at 9:30 AM");
        expect(lastSeenLabel(null)).toBe("offline");
    });
});
