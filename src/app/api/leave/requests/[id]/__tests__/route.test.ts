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
    leaveBalance:      { findUnique: vi.fn(), update: vi.fn() },
    leaveRequest:      { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    user:              { findUnique: vi.fn() },
    $transaction:      vi.fn(),
  },
}));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { PATCH } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;
const CTX = { params: Promise.resolve({ id: "req-1" }) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};

const PENDING_REQUEST = {
  id: "req-1", venueId: "venue-1", waiterId: "waiter-1", staffId: "staff-1",
  department: "FOH", type: "ANNUAL", status: "PENDING", year: 2026, days: 3,
  startDate: new Date("2026-08-10T00:00:00Z"),
  endDate:   new Date("2026-08-12T00:00:00Z"),
};

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

const patchReq = (body: object) =>
  new NextRequest("http://localhost/api/leave/requests/req-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const balanceUpdate = () => mdb.leaveBalance.update.mock.calls[0][0].data;
const requestUpdate = () => mdb.leaveRequest.update.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  mdb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mdb));
  mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
  mdb.venueStaff.findUnique.mockResolvedValue(null);
  mdb.venueBlackoutDate.findMany.mockResolvedValue([]);
  mdb.leavePolicy.findUnique.mockResolvedValue(null);
  mdb.leaveBalance.findUnique.mockResolvedValue({ id: "bal-1" });
  mdb.leaveBalance.update.mockResolvedValue({});
  mdb.leaveRequest.findUnique.mockResolvedValue(PENDING_REQUEST);
  mdb.leaveRequest.findMany.mockResolvedValue([]);
  mdb.leaveRequest.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "req-1", ...data,
    startDate: PENDING_REQUEST.startDate, endDate: PENDING_REQUEST.endDate,
  }));
  mdb.user.findUnique.mockResolvedValue({ name: "Marko" });
});

describe("guards", () => {
  it("404s an unknown request", async () => {
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue(null);
    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(404);
  });

  it("403s someone with no access to the venue", async () => {
    mockSession("WAITER", "stranger");
    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(403);
  });

  it("403s a rank-and-file worker approving anything", async () => {
    mockSession("WAITER", "waiter-2");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });

    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(403);
    expect(mdb.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("403s a head chef deciding on a floor request", async () => {
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(403);
  });

  it("403s a manager deciding on their own request", async () => {
    // Marking your own homework. This one goes to the owner.
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, waiterId: "hw-1" });

    const res = await PATCH(patchReq({ action: "approve" }), CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("sopstvenom");
  });

  it("409s a request that was already decided", async () => {
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, status: "APPROVED" });
    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(409);
  });

  it("rejects an unknown action", async () => {
    mockSession();
    expect((await PATCH(patchReq({ action: "obliterate" }), CTX)).status).toBe(400);
  });
});

describe("approve", () => {
  it("moves the reservation into used days", async () => {
    mockSession();
    const res = await PATCH(patchReq({ action: "approve" }), CTX);

    expect(res.status).toBe(200);
    expect(balanceUpdate()).toEqual({
      pendingDays: { decrement: 3 },
      usedDays:    { increment: 3 },
    });
  });

  it("records who decided and clears the auto-approved flag", async () => {
    mockSession();
    await PATCH(patchReq({ action: "approve" }), CTX);

    expect(requestUpdate()).toMatchObject({
      status: "APPROVED", reviewedById: "owner-1", autoApproved: false,
    });
  });

  it("re-checks capacity, since the queue may have gone stale", async () => {
    // Two pending requests already cover these days; the default cap is 2.
    mockSession();
    mdb.leaveRequest.findMany.mockResolvedValue([
      { startDate: PENDING_REQUEST.startDate, endDate: PENDING_REQUEST.endDate },
      { startDate: PENDING_REQUEST.startDate, endDate: PENDING_REQUEST.endDate },
    ]);

    const res = await PATCH(patchReq({ action: "approve" }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("popunjen");
  });

  it("excludes the request being approved from its own capacity count", async () => {
    mockSession();
    await PATCH(patchReq({ action: "approve" }), CTX);
    expect(mdb.leaveRequest.findMany.mock.calls[0][0].where.id).toEqual({ not: "req-1" });
  });

  it("409s when a day became blocked while the request waited", async () => {
    mockSession();
    mdb.venueBlackoutDate.findMany.mockResolvedValue([
      { date: new Date("2026-08-11T00:00:00Z"), maxOff: 0 },
    ]);

    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(409);
  });

  it("skips the capacity check for sick leave", async () => {
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, type: "SICK" });
    mdb.leaveRequest.findMany.mockResolvedValue([
      { startDate: PENDING_REQUEST.startDate, endDate: PENDING_REQUEST.endDate },
      { startDate: PENDING_REQUEST.startDate, endDate: PENDING_REQUEST.endDate },
    ]);

    expect((await PATCH(patchReq({ action: "approve" }), CTX)).status).toBe(200);
  });

  it("records sick days rather than spending annual leave", async () => {
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, type: "SICK" });

    await PATCH(patchReq({ action: "approve" }), CTX);
    expect(balanceUpdate()).toEqual({ sickDaysTaken: { increment: 3 } });
  });
});

describe("reject", () => {
  it("gives the reserved days back", async () => {
    // A rejection must not quietly cost the worker part of their entitlement.
    mockSession();
    await PATCH(patchReq({ action: "reject" }), CTX);
    expect(balanceUpdate()).toEqual({ pendingDays: { decrement: 3 } });
  });

  it("stores the reason", async () => {
    mockSession();
    await PATCH(patchReq({ action: "reject", rejectReason: "Sezona je" }), CTX);
    expect(requestUpdate()).toMatchObject({ status: "REJECTED", rejectReason: "Sezona je" });
  });

  it("does not touch used days", async () => {
    mockSession();
    await PATCH(patchReq({ action: "reject" }), CTX);
    expect(balanceUpdate().usedDays).toBeUndefined();
  });
});

describe("cancel", () => {
  it("lets the requester withdraw their own pending request", async () => {
    mockSession("WAITER", "waiter-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });

    const res = await PATCH(patchReq({ action: "cancel" }), CTX);
    expect(res.status).toBe(200);
    expect(balanceUpdate()).toEqual({ pendingDays: { decrement: 3 } });
  });

  it("refunds used days when cancelling an already-approved request", async () => {
    mockSession("WAITER", "waiter-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, status: "APPROVED" });

    await PATCH(patchReq({ action: "cancel" }), CTX);
    expect(balanceUpdate()).toEqual({ usedDays: { decrement: 3 } });
  });

  it("lets a manager cancel on the worker's behalf", async () => {
    mockSession();
    expect((await PATCH(patchReq({ action: "cancel" }), CTX)).status).toBe(200);
  });

  it("403s an unrelated worker cancelling someone else's request", async () => {
    mockSession("WAITER", "waiter-2");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });

    expect((await PATCH(patchReq({ action: "cancel" }), CTX)).status).toBe(403);
  });

  it("400s when the request was already rejected", async () => {
    mockSession("WAITER", "waiter-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ACTIVE" });
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, status: "REJECTED" });

    expect((await PATCH(patchReq({ action: "cancel" }), CTX)).status).toBe(400);
  });

  it("un-records sick days when an approved sick request is cancelled", async () => {
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue({
      ...PENDING_REQUEST, type: "SICK", status: "APPROVED",
    });

    await PATCH(patchReq({ action: "cancel" }), CTX);
    expect(balanceUpdate()).toEqual({ sickDaysTaken: { increment: -3 } });
  });

  it("does not touch the balance for a pending sick request", async () => {
    // Nothing was ever counted, so there is nothing to give back.
    mockSession();
    mdb.leaveRequest.findUnique.mockResolvedValue({ ...PENDING_REQUEST, type: "SICK" });

    await PATCH(patchReq({ action: "cancel" }), CTX);
    expect(mdb.leaveBalance.update).not.toHaveBeenCalled();
  });
});
