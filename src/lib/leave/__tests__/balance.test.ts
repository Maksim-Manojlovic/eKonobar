import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  remainingDays, ensureBalance, reservePending, releasePending,
  commitPending, commitDirect, refundUsed, recordSickDays, countOffPerDate,
  type Db,
} from "../balance";
import { DEFAULT_POLICY } from "../policy";
import { parseDateOnly } from "../dates";

const d = (s: string) => parseDateOnly(s)!;

function fakeDb() {
  return {
    leaveBalance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    leaveRequest: { findMany: vi.fn() },
  };
}
let db: ReturnType<typeof fakeDb>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = () => db as any as Db;

beforeEach(() => { db = fakeDb(); });

describe("remainingDays", () => {
  it("subtracts used and reserved from entitled plus carried in", () => {
    expect(remainingDays({
      entitledDays: 26, carriedInDays: 5, usedDays: 10, pendingDays: 3,
    })).toBe(18);
  });

  it("can go to exactly zero", () => {
    expect(remainingDays({
      entitledDays: 10, carriedInDays: 0, usedDays: 7, pendingDays: 3,
    })).toBe(0);
  });

  it("counts reserved days as unavailable", () => {
    // Pending must reduce what is bookable, or a worker can double-spend while
    // their first request sits in the queue.
    const base = { entitledDays: 26, carriedInDays: 0, usedDays: 0 };
    expect(remainingDays({ ...base, pendingDays: 0 })).toBe(26);
    expect(remainingDays({ ...base, pendingDays: 6 })).toBe(20);
  });
});

describe("ensureBalance", () => {
  it("creates a row on first use with a pro-rated entitlement", async () => {
    db.leaveBalance.findUnique.mockResolvedValue(null);
    db.leaveBalance.create.mockResolvedValue({ id: "b1" });

    await ensureBalance(asDb(), "staff-1", 2026, DEFAULT_POLICY, d("2026-07-01"));

    // July start → 6 of 12 months → half of 26, rounded.
    expect(db.leaveBalance.create.mock.calls[0][0].data).toMatchObject({
      staffId: "staff-1", year: 2026, entitledDays: 13,
    });
  });

  it("gives a full entitlement to someone who started in an earlier year", async () => {
    db.leaveBalance.findUnique.mockResolvedValue(null);
    db.leaveBalance.create.mockResolvedValue({ id: "b1" });

    await ensureBalance(asDb(), "staff-1", 2026, DEFAULT_POLICY, d("2019-03-01"));
    expect(db.leaveBalance.create.mock.calls[0][0].data.entitledDays).toBe(26);
  });

  it("returns the existing row untouched when the entitlement still matches", async () => {
    const row = { id: "b1", entitledDays: 26, usedDays: 4, pendingDays: 0 };
    db.leaveBalance.findUnique.mockResolvedValue(row);

    const result = await ensureBalance(asDb(), "staff-1", 2026, DEFAULT_POLICY, d("2019-03-01"));

    expect(result).toBe(row);
    expect(db.leaveBalance.update).not.toHaveBeenCalled();
  });

  it("raises the ceiling when the policy's annualDays increased", async () => {
    db.leaveBalance.findUnique.mockResolvedValue({ id: "b1", entitledDays: 26 });
    db.leaveBalance.update.mockResolvedValue({ id: "b1", entitledDays: 30 });

    await ensureBalance(asDb(), "staff-1", 2026, { ...DEFAULT_POLICY, annualDays: 30 }, d("2019-03-01"));

    expect(db.leaveBalance.update).toHaveBeenCalledWith({
      where: { id: "b1" }, data: { entitledDays: 30 },
    });
  });

  it("never rewrites used or pending days when adjusting the ceiling", async () => {
    db.leaveBalance.findUnique.mockResolvedValue({ id: "b1", entitledDays: 26, usedDays: 9, pendingDays: 2 });
    db.leaveBalance.update.mockResolvedValue({ id: "b1" });

    await ensureBalance(asDb(), "staff-1", 2026, { ...DEFAULT_POLICY, annualDays: 20 }, d("2019-03-01"));

    const data = db.leaveBalance.update.mock.calls[0][0].data;
    expect(data).toEqual({ entitledDays: 20 });
    expect(data.usedDays).toBeUndefined();
    expect(data.pendingDays).toBeUndefined();
  });
});

describe("balance mutations", () => {
  beforeEach(() => { db.leaveBalance.update.mockResolvedValue({}); });
  const data = () => db.leaveBalance.update.mock.calls[0][0].data;

  it("reserves days as pending", async () => {
    await reservePending(asDb(), "b1", 3);
    expect(data()).toEqual({ pendingDays: { increment: 3 } });
  });

  it("releases a reservation without spending it", async () => {
    await releasePending(asDb(), "b1", 3);
    expect(data()).toEqual({ pendingDays: { decrement: 3 } });
  });

  it("moves a reservation into used days on approval", async () => {
    // Both halves must happen together, or the days are counted twice.
    await commitPending(asDb(), "b1", 3);
    expect(data()).toEqual({
      pendingDays: { decrement: 3 },
      usedDays:    { increment: 3 },
    });
  });

  it("spends directly for a request that was never pending", async () => {
    await commitDirect(asDb(), "b1", 3);
    expect(data()).toEqual({ usedDays: { increment: 3 } });
  });

  it("refunds days from a cancelled approved request", async () => {
    await refundUsed(asDb(), "b1", 3);
    expect(data()).toEqual({ usedDays: { decrement: 3 } });
  });

  it("records sick days without touching the annual balance", async () => {
    await recordSickDays(asDb(), "b1", 4);
    expect(data()).toEqual({ sickDaysTaken: { increment: 4 } });
    expect(data().usedDays).toBeUndefined();
  });
});

describe("countOffPerDate", () => {
  it("counts one person per day across their range", async () => {
    db.leaveRequest.findMany.mockResolvedValue([
      { startDate: d("2026-08-10"), endDate: d("2026-08-12") },
    ]);

    const counts = await countOffPerDate(asDb(), "v1", "FOH", d("2026-08-01"), d("2026-08-31"));
    expect(counts.get("2026-08-10")).toBe(1);
    expect(counts.get("2026-08-11")).toBe(1);
    expect(counts.get("2026-08-12")).toBe(1);
    expect(counts.get("2026-08-13")).toBeUndefined();
  });

  it("stacks overlapping requests on the shared days", async () => {
    db.leaveRequest.findMany.mockResolvedValue([
      { startDate: d("2026-08-10"), endDate: d("2026-08-12") },
      { startDate: d("2026-08-11"), endDate: d("2026-08-13") },
    ]);

    const counts = await countOffPerDate(asDb(), "v1", "FOH", d("2026-08-01"), d("2026-08-31"));
    expect(counts.get("2026-08-10")).toBe(1);
    expect(counts.get("2026-08-11")).toBe(2);
    expect(counts.get("2026-08-12")).toBe(2);
    expect(counts.get("2026-08-13")).toBe(1);
  });

  it("counts pending requests, not just approved ones", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    await countOffPerDate(asDb(), "v1", "FOH", d("2026-08-01"), d("2026-08-31"));

    expect(db.leaveRequest.findMany.mock.calls[0][0].where.status)
      .toEqual({ in: ["APPROVED", "PENDING"] });
  });

  it("queries by overlap, so a request starting before the window still counts", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    const from = d("2026-08-01"), to = d("2026-08-31");
    await countOffPerDate(asDb(), "v1", "FOH", from, to);

    const where = db.leaveRequest.findMany.mock.calls[0][0].where;
    expect(where.startDate).toEqual({ lte: to });
    expect(where.endDate).toEqual({ gte: from });
  });

  it("clamps a request that overhangs the window", async () => {
    // A July-to-September absence must not add August days outside the window,
    // nor blow up the map with dates nobody asked about.
    db.leaveRequest.findMany.mockResolvedValue([
      { startDate: d("2026-07-25"), endDate: d("2026-09-05") },
    ]);

    const counts = await countOffPerDate(asDb(), "v1", "FOH", d("2026-08-01"), d("2026-08-03"));
    expect([...counts.keys()]).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("excludes a request being re-evaluated, so it does not block itself", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    await countOffPerDate(asDb(), "v1", "FOH", d("2026-08-01"), d("2026-08-31"), "req-1");

    expect(db.leaveRequest.findMany.mock.calls[0][0].where.id).toEqual({ not: "req-1" });
  });

  it("scopes to one department — cooks do not consume the floor's capacity", async () => {
    db.leaveRequest.findMany.mockResolvedValue([]);
    await countOffPerDate(asDb(), "v1", "BOH", d("2026-08-01"), d("2026-08-31"));

    expect(db.leaveRequest.findMany.mock.calls[0][0].where.department).toBe("BOH");
  });
});
