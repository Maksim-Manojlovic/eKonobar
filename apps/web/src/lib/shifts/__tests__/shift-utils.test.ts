import { describe, it, expect } from "vitest";
import { computeScheduledStart, computeScheduledEnd, shiftTimeToMins, shiftsOverlap } from "../utils";

describe("computeScheduledStart", () => {
  it("returns correct UTC datetime for date + time", () => {
    const result = computeScheduledStart("2025-06-15", "18:00");
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(5); // June = 5
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(18);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it("handles midnight (00:00)", () => {
    const result = computeScheduledStart("2025-01-01", "00:00");
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it("handles non-zero minutes", () => {
    const result = computeScheduledStart("2025-03-10", "14:30");
    expect(result.getUTCHours()).toBe(14);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it("returns a Date instance", () => {
    expect(computeScheduledStart("2025-01-01", "08:00")).toBeInstanceOf(Date);
  });
});

describe("computeScheduledEnd", () => {
  it("same-day shift (endTime > startTime) stays on same date", () => {
    const result = computeScheduledEnd("2025-06-15", "18:00", "23:00");
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(23);
  });

  it("overnight shift (endTime < startTime) advances to next day", () => {
    const result = computeScheduledEnd("2025-06-15", "22:00", "02:00");
    expect(result.getUTCDate()).toBe(16);
    expect(result.getUTCHours()).toBe(2);
  });

  it("overnight shift crossing month boundary", () => {
    const result = computeScheduledEnd("2025-01-31", "23:00", "01:00");
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCMonth()).toBe(1); // February
  });

  it("endTime === startTime treated as same day (0 offset)", () => {
    const result = computeScheduledEnd("2025-06-15", "18:00", "18:00");
    expect(result.getUTCDate()).toBe(15);
  });

  it("end midnight (00:00) with late start is overnight", () => {
    const result = computeScheduledEnd("2025-06-15", "20:00", "00:00");
    expect(result.getUTCDate()).toBe(16);
    expect(result.getUTCHours()).toBe(0);
  });

  it("returns Date instance", () => {
    expect(computeScheduledEnd("2025-01-01", "18:00", "02:00")).toBeInstanceOf(Date);
  });
});

describe("shiftTimeToMins", () => {
  it("converts HH:MM to minutes", () => {
    expect(shiftTimeToMins("00:00")).toBe(0);
    expect(shiftTimeToMins("01:00")).toBe(60);
    expect(shiftTimeToMins("08:30")).toBe(510);
    expect(shiftTimeToMins("23:59")).toBe(1439);
  });
});

describe("shiftsOverlap", () => {
  const make = (startTime: string, endTime: string, dayOfWeek: number | null = 1, weekdaysOnly = false) =>
    ({ startTime, endTime, dayOfWeek, weekdaysOnly });

  it("overlapping same-day shifts on same dayOfWeek", () => {
    expect(shiftsOverlap(make("08:00", "16:00"), make("12:00", "20:00"))).toBe(true);
  });

  it("non-overlapping same-day shifts on same dayOfWeek", () => {
    expect(shiftsOverlap(make("08:00", "14:00"), make("14:00", "20:00"))).toBe(false);
  });

  it("different dayOfWeek → no overlap", () => {
    expect(shiftsOverlap(make("08:00", "16:00", 1), make("08:00", "16:00", 3))).toBe(false);
  });

  it("weekdaysOnly flag → treated as overlapping regardless of dayOfWeek", () => {
    expect(shiftsOverlap(make("08:00", "16:00", 1, true), make("10:00", "18:00", 3, false))).toBe(true);
  });

  it("two overlapping overnight shifts conflict", () => {
    // 22:00–02:00 vs 23:00–03:00 — overlap in the 23:00–02:00 window
    expect(shiftsOverlap(make("22:00", "02:00"), make("23:00", "03:00"))).toBe(true);
  });

  it("overnight shift does not overlap daytime shift on the same day", () => {
    // 22:00–02:00 wraps to [1320–1560], 10:00–18:00 is [600–1080] — no intersection
    expect(shiftsOverlap(make("22:00", "02:00"), make("10:00", "18:00"))).toBe(false);
  });

  it("overnight shift does not overlap same-day morning block", () => {
    // Template A on date D: 22:00→02:00 (next day). Template B on date D: 01:00→09:00.
    // Morning block ends before overnight block starts — no same-day overlap.
    expect(shiftsOverlap(make("22:00", "02:00"), make("01:00", "09:00"))).toBe(false);
  });
});
