import { describe, it, expect } from "vitest";
import {
  parseDateOnly, formatDateOnly, addDays, daysBetween, isWeekend,
  eachDateInRange, countLeaveDays, rangesOverlap, splitByLeaveYear,
} from "../dates";

/** Shorthand — every fixture goes through the same UTC-anchored parser. */
const d = (s: string) => parseDateOnly(s)!;

describe("parseDateOnly", () => {
  it("parses a valid date to UTC midnight", () => {
    const parsed = d("2026-07-15");
    expect(parsed.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "2026-7-15", "15-07-2026", "2026/07/15", "yesterday", "2026-07-15T10:00:00Z"]) {
      expect(parseDateOnly(bad), bad).toBeNull();
    }
  });

  it("rejects dates that would silently roll over", () => {
    // new Date("2026-02-31") happily becomes 3 March. A request for a date that
    // does not exist is a bug, not a request for the day after.
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-04-31")).toBeNull();
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(parseDateOnly("2028-02-29")).not.toBeNull();  // 2028 is a leap year
    expect(parseDateOnly("2026-02-29")).toBeNull();      // 2026 is not
  });

  it("round-trips through formatDateOnly", () => {
    for (const s of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
      expect(formatDateOnly(d(s))).toBe(s);
    }
  });
});

describe("addDays / daysBetween", () => {
  it("adds and subtracts whole days", () => {
    expect(formatDateOnly(addDays(d("2026-07-15"), 1))).toBe("2026-07-16");
    expect(formatDateOnly(addDays(d("2026-07-15"), -1))).toBe("2026-07-14");
  });

  it("crosses month and year boundaries", () => {
    expect(formatDateOnly(addDays(d("2026-01-31"), 1))).toBe("2026-02-01");
    expect(formatDateOnly(addDays(d("2026-12-31"), 1))).toBe("2027-01-01");
  });

  it("crosses a DST transition without drifting", () => {
    // Serbia moves to summer time on 29 March 2026. A local-midnight
    // implementation would land on 22:00 or 02:00 and lose or gain a day.
    expect(formatDateOnly(addDays(d("2026-03-28"), 1))).toBe("2026-03-29");
    expect(formatDateOnly(addDays(d("2026-03-29"), 1))).toBe("2026-03-30");
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);
  });

  it("counts 0 between a date and itself", () => {
    expect(daysBetween(d("2026-07-15"), d("2026-07-15"))).toBe(0);
  });
});

describe("isWeekend", () => {
  it("flags Saturday and Sunday", () => {
    expect(isWeekend(d("2026-07-18"))).toBe(true);  // Saturday
    expect(isWeekend(d("2026-07-19"))).toBe(true);  // Sunday
  });

  it("does not flag weekdays", () => {
    for (const s of ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]) {
      expect(isWeekend(d(s)), s).toBe(false);
    }
  });
});

describe("eachDateInRange", () => {
  it("is inclusive of both ends", () => {
    expect(eachDateInRange(d("2026-07-15"), d("2026-07-18")))
      .toEqual(["2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18"]);
  });

  it("returns a single day for a same-day range", () => {
    expect(eachDateInRange(d("2026-07-15"), d("2026-07-15"))).toEqual(["2026-07-15"]);
  });

  it("returns empty for an inverted range rather than looping forever", () => {
    expect(eachDateInRange(d("2026-07-18"), d("2026-07-15"))).toEqual([]);
  });

  it("spans a year boundary", () => {
    expect(eachDateInRange(d("2026-12-30"), d("2027-01-02")))
      .toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("countLeaveDays", () => {
  it("counts a single day as 1, not 0", () => {
    expect(countLeaveDays(d("2026-07-15"), d("2026-07-15"))).toBe(1);
  });

  it("counts every calendar day by default", () => {
    // Mon 13 to Sun 19 July — includes the weekend.
    expect(countLeaveDays(d("2026-07-13"), d("2026-07-19"))).toBe(7);
  });

  it("skips weekends when countWeekends is false", () => {
    expect(countLeaveDays(d("2026-07-13"), d("2026-07-19"), false)).toBe(5);
  });

  it("counts 0 for a weekend-only range when weekends are excluded", () => {
    expect(countLeaveDays(d("2026-07-18"), d("2026-07-19"), false)).toBe(0);
  });

  it("returns 0 for an inverted range", () => {
    expect(countLeaveDays(d("2026-07-19"), d("2026-07-13"))).toBe(0);
  });

  it("counts a full year inclusively", () => {
    expect(countLeaveDays(d("2026-01-01"), d("2026-12-31"))).toBe(365);
    expect(countLeaveDays(d("2028-01-01"), d("2028-12-31"))).toBe(366);
  });
});

describe("rangesOverlap", () => {
  it("detects a shared day", () => {
    expect(rangesOverlap(d("2026-07-10"), d("2026-07-15"), d("2026-07-15"), d("2026-07-20"))).toBe(true);
  });

  it("treats adjacent ranges as not overlapping", () => {
    expect(rangesOverlap(d("2026-07-10"), d("2026-07-14"), d("2026-07-15"), d("2026-07-20"))).toBe(false);
  });

  it("detects full containment either way round", () => {
    expect(rangesOverlap(d("2026-07-01"), d("2026-07-31"), d("2026-07-10"), d("2026-07-12"))).toBe(true);
    expect(rangesOverlap(d("2026-07-10"), d("2026-07-12"), d("2026-07-01"), d("2026-07-31"))).toBe(true);
  });
});

describe("splitByLeaveYear", () => {
  it("leaves a single-year range untouched", () => {
    const segments = splitByLeaveYear(d("2026-07-01"), d("2026-07-10"));
    expect(segments).toHaveLength(1);
    expect(segments[0].year).toBe(2026);
  });

  it("splits a New Year range at the boundary", () => {
    // 28 Dec to 4 Jan must not take all eight days from one year's balance.
    const segments = splitByLeaveYear(d("2026-12-28"), d("2027-01-04"));
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ year: 2026 });
    expect(formatDateOnly(segments[0].to)).toBe("2026-12-31");
    expect(segments[1]).toMatchObject({ year: 2027 });
    expect(formatDateOnly(segments[1].from)).toBe("2027-01-01");
  });

  it("preserves the total day count across the split", () => {
    const from = d("2026-12-28"), to = d("2027-01-04");
    const total = splitByLeaveYear(from, to)
      .reduce((sum, s) => sum + countLeaveDays(s.from, s.to), 0);
    expect(total).toBe(countLeaveDays(from, to));
  });

  it("handles a range spanning more than two years", () => {
    const segments = splitByLeaveYear(d("2026-12-31"), d("2028-01-01"));
    expect(segments.map(s => s.year)).toEqual([2026, 2027, 2028]);
  });

  it("returns empty for an inverted range", () => {
    expect(splitByLeaveYear(d("2027-01-04"), d("2026-12-28"))).toEqual([]);
  });
});
