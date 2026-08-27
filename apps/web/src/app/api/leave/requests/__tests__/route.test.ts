import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:             { findUnique: vi.fn() },
    venueStaff:        { findUnique: vi.fn() },
    venueBlackoutDate: { findMany: vi.fn() },
    leavePolicy:       { findUnique: vi.fn() },
    leaveBalance:      { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    leaveRequest:      { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    user:              { findUnique: vi.fn() },
    $transaction:      vi.fn(),
  },
}));
vi.mock("@/lib/core/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { POST, GET } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;
const CTX = { params: Promise.resolve({}) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};

const STAFF = {
  id: "staff-1", department: "FOH", status: "ACTIVE",
  startedAt: new Date("2020-01-01T00:00:00Z"),
};

const BALANCE = {
  id: "bal-1", entitledDays: 26, carriedInDays: 0, usedDays: 0,
  pendingDays: 0, sickDaysTaken: 0,
};

function mockSession(role = "WAITER", id = "waiter-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

const postReq = (body: object) =>
  new NextRequest("http://localhost/api/leave/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Far enough ahead to satisfy the 14-day default notice. */
function futureRange(offsetDays = 60, length = 2) {
  const start = new Date(Date.now() + offsetDays * 86_400_000);
  const end   = new Date(start.getTime() + (length - 1) * 86_400_000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const created = () => mdb.leaveRequest.create.mock.calls[0][0].data;
const balanceUpdate = () => mdb.leaveBalance.update.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue(true);
  mdb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mdb));
  mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
  mdb.venueStaff.findUnique.mockResolvedValue(STAFF);
  mdb.venueBlackoutDate.findMany.mockResolvedValue([]);
  mdb.leavePolicy.findUnique.mockResolvedValue(null);
  mdb.leaveBalance.findUnique.mockResolvedValue(BALANCE);
  mdb.leaveBalance.update.mockResolvedValue(BALANCE);
  mdb.leaveRequest.findFirst.mockResolvedValue(null);
  mdb.leaveRequest.findMany.mockResolvedValue([]);
  mdb.leaveRequest.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "req-1", ...data,
    startDate: data.startDate, endDate: data.endDate,
    waiter: { id: "waiter-1", name: "Marko", image: null },
    staff: { position: "WAITER" }, venue: { id: "venue-1", name: "Kod Mike" },
  }));
  mdb.user.findUnique.mockResolvedValue({ name: "Marko" });
});

describe("POST — guards", () => {
  it("429s when the rate limit is hit", async () => {
    mockSession();
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    expect((await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX)).status).toBe(429);
  });

  it("400s on a malformed date", async () => {
    mockSession();
    const res = await POST(postReq({ venueId: "venue-1", startDate: "15.08.2026", endDate: "2026-08-16" }), CTX);
    expect(res.status).toBe(400);
  });

  it("400s on an inverted range", async () => {
    mockSession();
    const res = await POST(postReq({ venueId: "venue-1", startDate: "2026-08-20", endDate: "2026-08-10" }), CTX);
    expect(res.status).toBe(400);
  });

  it("400s on a range beyond the per-request cap", async () => {
    mockSession();
    const res = await POST(postReq({ venueId: "venue-1", startDate: "2026-01-01", endDate: "2026-12-31" }), CTX);
    expect(res.status).toBe(400);
  });

  it("403s someone with no relationship to the venue", async () => {
    // No roster row means no access at all — this never reaches the staff lookup.
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue(null);
    expect((await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX)).status).toBe(403);
  });

  it("403s an ex-employee", async () => {
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF, status: "ENDED" });
    expect((await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX)).status).toBe(403);
  });

  it("404s when a manager files for someone not on the roster", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    mdb.venueStaff.findUnique.mockResolvedValue(null);

    const res = await POST(postReq({ venueId: "venue-1", waiterId: "ghost-1", ...futureRange() }), CTX);
    expect(res.status).toBe(404);
  });

  it("rejects a holiday in the past", async () => {
    mockSession();
    const res = await POST(postReq({
      venueId: "venue-1", startDate: "2020-01-01", endDate: "2020-01-02",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("409s when the worker already has a request covering those days", async () => {
    mockSession();
    mdb.leaveRequest.findFirst.mockResolvedValue({
      id: "req-old",
      startDate: new Date("2026-08-10T00:00:00Z"),
      endDate:   new Date("2026-08-14T00:00:00Z"),
    });

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("2026-08-10");
  });
});

describe("POST — auto-approval", () => {
  it("approves a clean request without a human", async () => {
    mockSession();
    const res = await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);

    expect(res.status).toBe(201);
    expect(created()).toMatchObject({ status: "APPROVED", autoApproved: true });
  });

  it("spends the days directly when auto-approved", async () => {
    mockSession();
    await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(balanceUpdate()).toEqual({ usedDays: { increment: 2 } });
  });

  it("reserves rather than spends when the request is queued", async () => {
    mockSession();
    mdb.leavePolicy.findUnique.mockResolvedValue({
      id: "p", venueId: "venue-1", department: "FOH",
      annualDays: 26, maxConcurrentOff: 2, minNoticeDays: 14,
      autoApprove: false, countWeekends: true,
      allowCarryOver: true, carryOverDays: 5, carryOverDeadline: "06-30",
    });

    await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(created().status).toBe("PENDING");
    expect(balanceUpdate()).toEqual({ pendingDays: { increment: 2 } });
  });

  it("computes days server-side, ignoring anything the client sends", async () => {
    mockSession();
    await POST(postReq({ venueId: "venue-1", ...futureRange(60, 3), days: 999 }), CTX);
    expect(created().days).toBe(3);
  });
});

describe("POST — rejections from the decision engine", () => {
  it("409s when a day in the range is blocked", async () => {
    mockSession();
    const { startDate } = futureRange();
    mdb.venueBlackoutDate.findMany.mockResolvedValue([
      { date: new Date(`${startDate}T00:00:00Z`), maxOff: 0 },
    ]);

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("zatvoren");
    expect(mdb.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("409s when the balance is spent", async () => {
    // Exhaustion has to come from usedDays: ensureBalance re-syncs entitledDays
    // from the policy on every call, so lowering the ceiling would be undone.
    mockSession();
    mdb.leaveBalance.findUnique.mockResolvedValue({ ...BALANCE, usedDays: 24 });
    mdb.leaveBalance.update.mockResolvedValue({ ...BALANCE, usedDays: 24 });

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange(60, 5) }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("dovoljno dana");
  });

  it("counts reserved days as unavailable", async () => {
    mockSession();
    mdb.leaveBalance.findUnique.mockResolvedValue({ ...BALANCE, usedDays: 20, pendingDays: 4 });

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange(60, 5) }), CTX);
    expect(res.status).toBe(409);
  });

  it("queues rather than rejects when the day is at capacity", async () => {
    mockSession();
    const { startDate, endDate } = futureRange();
    mdb.leaveRequest.findMany.mockResolvedValue([
      { startDate: new Date(`${startDate}T00:00:00Z`), endDate: new Date(`${endDate}T00:00:00Z`) },
      { startDate: new Date(`${startDate}T00:00:00Z`), endDate: new Date(`${endDate}T00:00:00Z`) },
    ]);

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(res.status).toBe(201);
    expect(created().status).toBe("PENDING");
  });
});

describe("POST — sick leave", () => {
  it("queues a worker's own sick note for confirmation", async () => {
    mockSession();
    const res = await POST(postReq({ venueId: "venue-1", type: "SICK", ...futureRange(1) }), CTX);
    expect(res.status).toBe(201);
    expect(created().status).toBe("PENDING");
  });

  it("allows retroactive dates, unlike a holiday", async () => {
    mockSession();
    const res = await POST(postReq({
      venueId: "venue-1", type: "SICK", startDate: "2026-07-01", endDate: "2026-07-03",
    }), CTX);
    expect(res.status).toBe(201);
  });

  it("is approved immediately when the manager files it", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await POST(postReq({
      venueId: "venue-1", type: "SICK", waiterId: "waiter-9", ...futureRange(1),
    }), CTX);

    expect(res.status).toBe(201);
    expect(created()).toMatchObject({ status: "APPROVED", waiterId: "waiter-9" });
  });

  it("records sick days without touching the annual balance", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    await POST(postReq({ venueId: "venue-1", type: "SICK", waiterId: "waiter-9", ...futureRange(1) }), CTX);

    expect(balanceUpdate()).toEqual({ sickDaysTaken: { increment: 2 } });
    expect(balanceUpdate().usedDays).toBeUndefined();
  });

  it("is granted even when the day is blocked", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const { startDate } = futureRange(1);
    mdb.venueBlackoutDate.findMany.mockResolvedValue([
      { date: new Date(`${startDate}T00:00:00Z`), maxOff: 0 },
    ]);

    const res = await POST(postReq({
      venueId: "venue-1", type: "SICK", waiterId: "waiter-9", ...futureRange(1),
    }), CTX);
    expect(res.status).toBe(201);
  });
});

describe("POST — filing on behalf", () => {
  it("403s a rank-and-file worker filing for someone else", async () => {
    mockSession("WAITER", "waiter-1");
    mdb.venueStaff.findUnique.mockResolvedValue(STAFF);

    const res = await POST(postReq({ venueId: "venue-1", waiterId: "waiter-9", ...futureRange() }), CTX);
    expect(res.status).toBe(403);
  });

  it("403s a head waiter filing for a kitchen worker", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF, department: "BOH" });

    const res = await POST(postReq({ venueId: "venue-1", waiterId: "cook-1", ...futureRange() }), CTX);
    expect(res.status).toBe(403);
  });
});

describe("POST — a manager's own request", () => {
  it("is queued for the owner rather than self-approved", async () => {
    // A head waiter approving their own leave would be marking their own homework.
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    const res = await POST(postReq({ venueId: "venue-1", ...futureRange() }), CTX);
    expect(res.status).toBe(201);
    expect(created()).toMatchObject({ status: "PENDING", autoApproved: false });
  });
});

describe("POST — year boundary", () => {
  it("splits a New Year range into one request per leave year", async () => {
    mockSession();
    const res = await POST(postReq({
      venueId: "venue-1", startDate: "2026-12-28", endDate: "2027-01-04",
    }), CTX);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.split).toBe(true);
    expect(body.requests).toHaveLength(2);

    const calls: { year: number; days: number }[] =
      mdb.leaveRequest.create.mock.calls.map((c: [{ data: { year: number; days: number } }]) => c[0].data);
    expect(calls.map(c => c.year)).toEqual([2026, 2027]);
    // 28-31 Dec is 4 days, 1-4 Jan is 4 — total matches the 8-day range.
    expect(calls.reduce((s, c) => s + c.days, 0)).toBe(8);
  });

  it("draws each half from its own year's balance", async () => {
    mockSession();
    await POST(postReq({ venueId: "venue-1", startDate: "2026-12-28", endDate: "2027-01-04" }), CTX);

    const years = mdb.leaveBalance.findUnique.mock.calls
      .map((c: [{ where: { staffId_year: { year: number } } }]) => c[0].where.staffId_year.year);
    expect(years).toContain(2026);
    expect(years).toContain(2027);
  });
});

describe("GET", () => {
  it("returns only the caller's own requests when no venue is given", async () => {
    mockSession();
    const res = await GET(new NextRequest("http://localhost/api/leave/requests"), CTX);

    expect((await res.json()).scope).toBe("own");
    expect(mdb.leaveRequest.findMany.mock.calls[0][0].where.waiterId).toBe("waiter-1");
  });

  it("gives a manager the whole department queue", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await GET(new NextRequest("http://localhost/api/leave/requests?venueId=venue-1"), CTX);

    expect((await res.json()).scope).toBe("manage");
    expect(mdb.leaveRequest.findMany.mock.calls[0][0].where.department).toEqual({ in: ["FOH", "BOH"] });
  });

  it("keeps rank-and-file staff scoped to their own rows at their own venue", async () => {
    // Another worker's sick leave is not their business.
    mockSession("WAITER", "waiter-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });

    const res = await GET(new NextRequest("http://localhost/api/leave/requests?venueId=venue-1"), CTX);
    expect((await res.json()).scope).toBe("own");
    expect(mdb.leaveRequest.findMany.mock.calls[0][0].where.waiterId).toBe("waiter-1");
  });

  it("403s a stranger asking about a venue", async () => {
    mockSession("WAITER", "stranger");
    mdb.venueStaff.findUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost/api/leave/requests?venueId=venue-1"), CTX);
    expect(res.status).toBe(403);
  });
});
