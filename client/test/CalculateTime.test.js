import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateTime } from "@/utils/CalculateTime";

// Most users are not on UTC; the app's author is in IST (UTC+05:30).
process.env.TZ = "Asia/Kolkata";

const at = (iso) => new Date(iso);

describe("calculateTime", () => {
    afterEach(() => vi.useRealTimers());

    it("shows a clock time for a message sent earlier today", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-15T18:00:00+05:30"));
        expect(calculateTime("2026-09-15T09:05:00+05:30")).toBe("9:05 AM");
    });

    it("shows 'Yesterday' mid-month", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-15T18:00:00+05:30"));
        expect(calculateTime("2026-09-14T12:00:00+05:30")).toBe("Yesterday");
    });

    it("shows the weekday for messages 3-6 days old", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-15T18:00:00+05:30")); // Tuesday
        expect(calculateTime("2026-09-11T12:00:00+05:30")).toBe("Friday");
    });

    it("[B-C15] shows 'Yesterday' (not a clock time) for 11 PM yesterday, viewed at 1 AM local", () => {
        vi.useFakeTimers();
        // 01:00 IST on the 16th is still the 15th in UTC; the function compares UTC dates.
        vi.setSystemTime(at("2026-09-16T01:00:00+05:30"));
        expect(calculateTime("2026-09-15T23:00:00+05:30")).toBe("Yesterday");
    });

    it("[B-C15] shows 'Yesterday' on the 1st of the month", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-10-01T18:00:00+05:30"));
        expect(calculateTime("2026-09-30T12:00:00+05:30")).toBe("Yesterday");
    });

    it("[B-C15] shows a weekday (not a full date) for a message two calendar days ago but < 48h old", () => {
        vi.useFakeTimers();
        vi.setSystemTime(at("2026-09-16T01:00:00+05:30")); // Wednesday 01:00
        expect(calculateTime("2026-09-14T23:00:00+05:30")).toBe("Monday");
    });

    it("[B-C15] handles a missing timestamp gracefully", () => {
        expect(calculateTime(undefined)).toBe("");
    });
});
