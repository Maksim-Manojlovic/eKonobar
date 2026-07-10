import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:            { findUnique: vi.fn() },
    shiftAssignment:  { findMany: vi.fn() },
    waiterPassport:   { findMany: vi.fn() },
    review:           { findMany: vi.fn() },
    shiftSwapRequest: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET } from "../route";

const VENUE_ID = "venue-1";
const OWNER_ID = "owner-1";
const WAITER_ID = "waiter-1";

function makeReq(period?: number) {
  const qs = period ? `?period=${period}` : "";
  return new NextRequest(`http://localhost/api/venues/${VENUE_ID}/waiter-analytics${qs}`);
}
const CTX = { params: Promise.resolve({ id: VENUE_ID }) };

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role, name: "T" } } as never);
}

const pastStart = new Date(Date.now() - 3 * 3_600_000);

describe("GET /api/venues/[id]/waiter-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.venue.findUnique).mockResolvedValue({ id: VENUE_ID, ownerId: OWNER_ID, headWaiterId: null } as never);
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.waiterPassport.findMany).mockResolvedValue([] as never);
    vi.mocked(db.review.findMany).mockResolvedValue([] as never);
    vi.mocked(db.shiftSwapRequest.findMany).mockResolvedValue([] as never);
  });

  it("returns 404 when venue not found", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue(null as never);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 403 for a waiter who is not the head waiter", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("allows the head waiter", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue({ id: VENUE_ID, ownerId: OWNER_ID, headWaiterId: WAITER_ID } as never);
    mockSession("WAITER", WAITER_ID);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  it("rejects an invalid period", async () => {
    const res = await GET(makeReq(15), CTX);
    expect(res.status).toBe(400);
  });

  it("defaults period to 30 and computes analytics", async () => {
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([
      {
        waiterId: WAITER_ID,
        clockInAt: pastStart,
        clockOutAt: new Date(pastStart.getTime() + 8 * 3_600_000),
        lateMinutes: 0,
        earlyExitAt: null,
        cancelledLate: false,
        waiter: { name: "Marko" },
        shift: { date: pastStart, scheduledStart: pastStart },
      },
    ] as never);
    vi.mocked(db.waiterPassport.findMany).mockResolvedValue([
      { userId: WAITER_ID, sanitaryBookValid: true, sanitaryExpiry: null, passportTier: "PRO" },
    ] as never);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe(30);
    expect(body.waiters).toHaveLength(1);
    expect(body.waiters[0].name).toBe("Marko");
    expect(body.waiters[0].passportTier).toBe("PRO");
    expect(body.team.rosterSize).toBe(1);
  });

  it("skips the passport + review queries when no assignments", async () => {
    const res = await GET(makeReq(90), CTX);
    expect(res.status).toBe(200);
    expect(db.waiterPassport.findMany).not.toHaveBeenCalled();
    expect(db.review.findMany).not.toHaveBeenCalled();
    expect(db.shiftSwapRequest.findMany).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.waiters).toHaveLength(0);
  });

  it("aggregates guest reviews for the roster", async () => {
    vi.mocked(db.shiftAssignment.findMany).mockImplementation((async (args: { where?: { shift?: { date?: { lt?: Date } } } }) => {
      // previous window has `lt` in the date filter — return empty for it
      if (args?.where?.shift?.date?.lt) return [] as never;
      return [
        {
          waiterId: WAITER_ID,
          clockInAt: pastStart,
          clockOutAt: new Date(pastStart.getTime() + 8 * 3_600_000),
          lateMinutes: 0,
          earlyExitAt: null,
          cancelledLate: false,
          waiter: { name: "Marko" },
          shift: { date: pastStart, scheduledStart: pastStart },
        },
      ] as never;
    }) as never);
    vi.mocked(db.review.findMany).mockResolvedValue([
      { subjectId: WAITER_ID, overallRating: 90, ratingFriendliness: 90, ratingGuestSpeed: 90, ratingAttentiveness: null },
    ] as never);

    const res = await GET(makeReq(30), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.waiters[0].guestRating.count).toBe(1);
    expect(body.waiters[0].guestRating.overall).toBe(90);
    expect(body.team.teamGuestRating).toBe(90);
  });
});
