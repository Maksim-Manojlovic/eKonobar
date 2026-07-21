import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  db: {
    leaveRequest:    { findMany: vi.fn(), findFirst: vi.fn() },
    shiftAssignment: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { findLeaveOnDate, isOnLeave, findLeaveInRange, findShiftConflicts } from "../conflicts";
import { parseDateOnly } from "../dates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;
const d = (s: string) => parseDateOnly(s)!;

const LEAVE_ROW = {
  id: "req-1", waiterId: "w-1", type: "ANNUAL",
  startDate: d("2026-08-10"), endDate: d("2026-08-14"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mdb.leaveRequest.findMany.mockResolvedValue([]);
  mdb.leaveRequest.findFirst.mockResolvedValue(null);
  mdb.shiftAssignment.findMany.mockResolvedValue([]);
});

describe("findLeaveOnDate", () => {
  it("returns nothing without querying when given no waiters", async () => {
    expect(await findLeaveOnDate([], d("2026-08-12"))).toEqual([]);
    expect(mdb.leaveRequest.findMany).not.toHaveBeenCalled();
  });

  it("matches leave spanning the date", async () => {
    mdb.leaveRequest.findMany.mockResolvedValue([LEAVE_ROW]);

    const found = await findLeaveOnDate(["w-1"], d("2026-08-12"));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ waiterId: "w-1", requestId: "req-1", type: "ANNUAL" });
  });

  it("queries with the date inside the leave range, not the other way round", async () => {
    const date = d("2026-08-12");
    await findLeaveOnDate(["w-1"], date);

    const where = mdb.leaveRequest.findMany.mock.calls[0][0].where;
    expect(where.startDate).toEqual({ lte: date });
    expect(where.endDate).toEqual({ gte: date });
  });

  it("only counts approved leave", async () => {
    // A pending request is not a commitment. Treating it as one would let
    // anyone freeze the rota just by asking.
    await findLeaveOnDate(["w-1"], d("2026-08-12"));
    expect(mdb.leaveRequest.findMany.mock.calls[0][0].where.status).toBe("APPROVED");
  });
});

describe("isOnLeave", () => {
  it("is true when a matching request exists", async () => {
    mdb.leaveRequest.findFirst.mockResolvedValue({ id: "req-1" });
    expect(await isOnLeave("w-1", d("2026-08-12"))).toBe(true);
  });

  it("is false when none does", async () => {
    expect(await isOnLeave("w-1", d("2026-08-12"))).toBe(false);
  });

  it("only counts approved leave", async () => {
    await isOnLeave("w-1", d("2026-08-12"));
    expect(mdb.leaveRequest.findFirst.mock.calls[0][0].where.status).toBe("APPROVED");
  });
});

describe("findLeaveInRange", () => {
  it("short-circuits on an empty waiter list", async () => {
    expect(await findLeaveInRange([], d("2026-08-01"), d("2026-08-31"))).toEqual([]);
    expect(mdb.leaveRequest.findMany).not.toHaveBeenCalled();
  });

  it("queries by overlap so leave starting earlier still matches", async () => {
    const from = d("2026-08-01"), to = d("2026-08-31");
    await findLeaveInRange(["w-1"], from, to);

    const where = mdb.leaveRequest.findMany.mock.calls[0][0].where;
    expect(where.startDate).toEqual({ lte: to });
    expect(where.endDate).toEqual({ gte: from });
  });

  it("returns one entry per matching request", async () => {
    mdb.leaveRequest.findMany.mockResolvedValue([
      LEAVE_ROW,
      { ...LEAVE_ROW, id: "req-2", waiterId: "w-2" },
    ]);

    const found = await findLeaveInRange(["w-1", "w-2"], d("2026-08-01"), d("2026-08-31"));
    expect(found.map(f => f.waiterId)).toEqual(["w-1", "w-2"]);
  });
});

describe("findShiftConflicts", () => {
  it("scopes to the worker and the leave window", async () => {
    const from = d("2026-08-10"), to = d("2026-08-14");
    await findShiftConflicts("w-1", from, to);

    const where = mdb.shiftAssignment.findMany.mock.calls[0][0].where;
    expect(where.waiterId).toBe("w-1");
    expect(where.shift.date).toEqual({ gte: from, lte: to });
  });

  it("ignores cancelled and completed shifts", async () => {
    // Neither needs the manager's attention when approving leave.
    await findShiftConflicts("w-1", d("2026-08-10"), d("2026-08-14"));
    expect(mdb.shiftAssignment.findMany.mock.calls[0][0].where.shift.status)
      .toEqual({ notIn: ["CANCELLED", "COMPLETED"] });
  });

  it("returns the assignments it finds", async () => {
    mdb.shiftAssignment.findMany.mockResolvedValue([
      { id: "asg-1", shift: { id: "s-1", title: "Večernja", date: d("2026-08-11"), startTime: "18:00", endTime: "02:00" } },
    ]);

    const found = await findShiftConflicts("w-1", d("2026-08-10"), d("2026-08-14"));
    expect(found).toHaveLength(1);
    expect(found[0].shift.title).toBe("Večernja");
  });
});
