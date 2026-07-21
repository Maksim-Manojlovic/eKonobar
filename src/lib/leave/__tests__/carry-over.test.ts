import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  db: {
    venueStaff:   { findMany: vi.fn() },
    leavePolicy:  { findMany: vi.fn() },
    leaveBalance: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { isPastDeadline, carryOverAmount, runLeaveRollover } from "../carry-over";
import { DEFAULT_POLICY } from "../policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;

const STAFF = {
  id: "staff-1", venueId: "venue-1", department: "FOH",
  startedAt: new Date("2019-01-01T00:00:00Z"),
};

const balance = (over: Record<string, unknown> = {}) => ({
  id: "bal-prev", staffId: "staff-1", year: 2025,
  entitledDays: 26, carriedInDays: 0, usedDays: 0, pendingDays: 0, sickDaysTaken: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mdb.venueStaff.findMany.mockResolvedValue([STAFF]);
  mdb.leavePolicy.findMany.mockResolvedValue([]);
  mdb.leaveBalance.findMany.mockResolvedValue([]);
  mdb.leaveBalance.findUnique.mockResolvedValue(null);
  mdb.leaveBalance.create.mockResolvedValue({ id: "bal-new" });
  mdb.leaveBalance.update.mockResolvedValue({});
});

describe("isPastDeadline", () => {
  it("is false before the deadline", () => {
    expect(isPastDeadline("06-30", new Date("2026-06-29T00:00:00Z"))).toBe(false);
  });

  it("is true on the deadline itself", () => {
    expect(isPastDeadline("06-30", new Date("2026-06-30T00:00:00Z"))).toBe(true);
  });

  it("is true after the deadline", () => {
    expect(isPastDeadline("06-30", new Date("2026-09-01T00:00:00Z"))).toBe(true);
  });

  it("never expires anything on a malformed deadline", () => {
    // Losing someone's leave to a typo is worse than carrying it too long.
    for (const bad of ["30 June", "6-30", "", "13-01", "06-32", "abc"]) {
      expect(isPastDeadline(bad, new Date("2026-12-31T00:00:00Z")), bad).toBe(false);
    }
  });

  it("compares within the current year", () => {
    expect(isPastDeadline("01-31", new Date("2026-02-01T00:00:00Z"))).toBe(true);
    expect(isPastDeadline("12-31", new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("carryOverAmount", () => {
  it("carries the leftover, capped by policy", () => {
    // 26 entitled, 20 used → 6 left, capped at 5.
    expect(carryOverAmount(DEFAULT_POLICY, balance({ usedDays: 20 }))).toBe(5);
  });

  it("carries less than the cap when less is left", () => {
    expect(carryOverAmount(DEFAULT_POLICY, balance({ usedDays: 24 }))).toBe(2);
  });

  it("carries nothing when carry-over is disabled", () => {
    expect(carryOverAmount({ ...DEFAULT_POLICY, allowCarryOver: false }, balance())).toBe(0);
  });

  it("carries nothing when the balance is fully spent", () => {
    expect(carryOverAmount(DEFAULT_POLICY, balance({ usedDays: 26 }))).toBe(0);
  });

  it("never returns a negative — an over-spent balance carries zero, not a debt", () => {
    expect(carryOverAmount(DEFAULT_POLICY, balance({ usedDays: 40 }))).toBe(0);
  });

  it("treats reserved days as unavailable to carry", () => {
    expect(carryOverAmount(DEFAULT_POLICY, balance({ usedDays: 20, pendingDays: 4 }))).toBe(2);
  });
});

describe("runLeaveRollover — opening the new year", () => {
  it("creates a balance for staff who have none", async () => {
    const result = await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));

    expect(result.balancesCreated).toBe(1);
    expect(mdb.leaveBalance.create.mock.calls[0][0].data).toMatchObject({
      staffId: "staff-1", year: 2026, entitledDays: 26,
    });
  });

  it("carries unused days from the previous year", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([balance({ year: 2025, usedDays: 20 })]);

    const result = await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));
    expect(mdb.leaveBalance.create.mock.calls[0][0].data.carriedInDays).toBe(5);
    expect(result.daysCarried).toBe(5);
  });

  it("is idempotent — a second run creates nothing", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([
      balance({ id: "bal-curr", year: 2026, carriedInDays: 0 }),
    ]);

    const result = await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));
    expect(result.balancesCreated).toBe(0);
    expect(mdb.leaveBalance.create).not.toHaveBeenCalled();
  });

  it("skips staff who have left", async () => {
    mdb.venueStaff.findMany.mockResolvedValue([]);

    const result = await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));
    expect(result.balancesCreated).toBe(0);
    expect(mdb.venueStaff.findMany.mock.calls[0][0].where.status).toEqual({ not: "ENDED" });
  });

  it("pro-rates someone who joined mid-year", async () => {
    mdb.venueStaff.findMany.mockResolvedValue([
      { ...STAFF, startedAt: new Date("2026-07-01T00:00:00Z") },
    ]);

    await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));
    expect(mdb.leaveBalance.create.mock.calls[0][0].data.entitledDays).toBe(13);
  });

  it("uses the venue's own policy over the defaults", async () => {
    mdb.leavePolicy.findMany.mockResolvedValue([{
      id: "p1", venueId: "venue-1", department: "FOH",
      annualDays: 20, maxConcurrentOff: 2, minNoticeDays: 14,
      autoApprove: true, countWeekends: true,
      allowCarryOver: true, carryOverDays: 5, carryOverDeadline: "06-30",
    }]);

    await runLeaveRollover(new Date("2026-01-01T00:00:00Z"));
    expect(mdb.leaveBalance.create.mock.calls[0][0].data.entitledDays).toBe(20);
  });
});

describe("runLeaveRollover — expiring carry-over", () => {
  const withCarry = (over: Record<string, unknown> = {}) =>
    balance({ id: "bal-curr", year: 2026, carriedInDays: 5, ...over });

  it("does not expire before the deadline", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry()]);

    const result = await runLeaveRollover(new Date("2026-03-01T00:00:00Z"));
    expect(result.daysExpired).toBe(0);
    expect(mdb.leaveBalance.update).not.toHaveBeenCalled();
  });

  it("expires unused carry-over past the deadline", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry()]);

    const result = await runLeaveRollover(new Date("2026-07-01T00:00:00Z"));
    expect(result.daysExpired).toBe(5);
    expect(mdb.leaveBalance.update.mock.calls[0][0].data)
      .toEqual({ carriedInDays: { decrement: 5 } });
  });

  it("treats carried days as spent first, so used days survive", async () => {
    // 5 carried, 3 used → only 2 of the carried days went unused.
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry({ usedDays: 3 })]);

    const result = await runLeaveRollover(new Date("2026-07-01T00:00:00Z"));
    expect(result.daysExpired).toBe(2);
  });

  it("expires nothing when the carried days were all used", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry({ usedDays: 8 })]);

    const result = await runLeaveRollover(new Date("2026-07-01T00:00:00Z"));
    expect(result.daysExpired).toBe(0);
    expect(mdb.leaveBalance.update).not.toHaveBeenCalled();
  });

  it("counts reserved days as protecting the carry-over", async () => {
    // A pending request covering those days must not have them pulled away.
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry({ pendingDays: 5 })]);

    const result = await runLeaveRollover(new Date("2026-07-01T00:00:00Z"));
    expect(result.daysExpired).toBe(0);
  });

  it("is idempotent — a second run past the deadline expires nothing more", async () => {
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry({ carriedInDays: 0 })]);

    const result = await runLeaveRollover(new Date("2026-07-01T00:00:00Z"));
    expect(result.daysExpired).toBe(0);
    expect(mdb.leaveBalance.update).not.toHaveBeenCalled();
  });

  it("respects a venue's custom deadline", async () => {
    mdb.leavePolicy.findMany.mockResolvedValue([{
      id: "p1", venueId: "venue-1", department: "FOH",
      annualDays: 26, maxConcurrentOff: 2, minNoticeDays: 14,
      autoApprove: true, countWeekends: true,
      allowCarryOver: true, carryOverDays: 5, carryOverDeadline: "03-31",
    }]);
    mdb.leaveBalance.findMany.mockResolvedValue([withCarry()]);

    // Past the venue's March deadline, though before the platform default.
    const result = await runLeaveRollover(new Date("2026-04-01T00:00:00Z"));
    expect(result.daysExpired).toBe(5);
  });
});
