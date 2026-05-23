import { describe, it, expect } from "vitest";
import { computeScheduledStart, computeScheduledEnd } from "../shift-utils";

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
