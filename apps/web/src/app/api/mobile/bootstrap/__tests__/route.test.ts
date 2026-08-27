import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    notification:    { count: vi.fn() },
    waiterPassport:  { findUnique: vi.fn() },
    shiftAssignment: { count: vi.fn() },
    invite:          { count: vi.fn() },
    venueStaff:      { count: vi.fn() },
    venue:           { findFirst: vi.fn() },
    jobPost:         { count: vi.fn() },
    jobApplication:  { count: vi.fn() },
    leaveRequest:    { count: vi.fn() },
    sanitaryBook:    { count: vi.fn() },
    review:          { count: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { getReq, CTX, mockSession, mockNoSession } from "@/tests/unit/route-harness";
import { GET } from "../route";

const VENUE = {
  id: "venue-1", name: "Bar Mixer", municipality: "Vračar",
  trustScore: 86, isActive: true, logo: null,
};

describe("GET /api/mobile/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.notification.count).mockResolvedValue(3 as never);
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.shiftAssignment.count).mockResolvedValue(0 as never);
    vi.mocked(db.invite.count).mockResolvedValue(0 as never);
    vi.mocked(db.venueStaff.count).mockResolvedValue(0 as never);
    vi.mocked(db.venue.findFirst).mockResolvedValue(VENUE as never);
    vi.mocked(db.jobPost.count).mockResolvedValue(0 as never);
    vi.mocked(db.jobApplication.count).mockResolvedValue(0 as never);
    vi.mocked(db.leaveRequest.count).mockResolvedValue(0 as never);
    vi.mocked(db.sanitaryBook.count).mockResolvedValue(0 as never);
    vi.mocked(db.review.count).mockResolvedValue(0 as never);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    expect((await GET(getReq(), CTX)).status).toBe(401);
  });

  it("WAITER gets the waiter block and no owner block", async () => {
    mockSession("WAITER", "waiter-1");
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      score: 87, currentlyAvailable: true, sanitaryBookValid: true, profilePhoto: null,
    } as never);
    vi.mocked(db.venueStaff.count).mockResolvedValue(2 as never);

    const json = await (await GET(getReq(), CTX)).json();

    expect(json.unreadNotifications).toBe(3);
    expect(json.waiter.passport.score).toBe(87);
    expect(json.waiter.staffRosters).toBe(2);
    expect(json.owner).toBeUndefined();
    expect(json.admin).toBeUndefined();
  });

  it("a waiter with no passport gets null, not an error", async () => {
    mockSession("WAITER", "waiter-1");
    const json = await (await GET(getReq(), CTX)).json();
    expect(json.waiter.passport).toBeNull();
  });

  it("VENUE_OWNER gets the venue and its counters", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    vi.mocked(db.jobPost.count).mockResolvedValue(4 as never);
    vi.mocked(db.leaveRequest.count).mockResolvedValue(2 as never);

    const json = await (await GET(getReq(), CTX)).json();

    expect(json.owner.venue.id).toBe("venue-1");
    expect(json.owner.activePosts).toBe(4);
    expect(json.owner.pendingLeaveRequests).toBe(2);
    expect(json.waiter).toBeUndefined();
  });

  it("picks the venue the same way GET /api/venues does", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    await GET(getReq(), CTX);

    // An owner with two venues would otherwise get a home screen counting one
    // and a Profil tab showing the other, since the app takes venues[0].
    expect(vi.mocked(db.venue.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("an owner with no venue gets zeroed counters, not a crash", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    vi.mocked(db.venue.findFirst).mockResolvedValue(null as never);

    const json = await (await GET(getReq(), CTX)).json();

    expect(json.owner.venue).toBeNull();
    expect(json.owner.pendingClockIns).toBe(0);
    // The venue-scoped counts must not run at all without a venue id to scope by.
    expect(vi.mocked(db.leaveRequest.count)).not.toHaveBeenCalled();
  });

  it("ADMIN gets the review queues", async () => {
    mockSession("ADMIN", "admin-1");
    vi.mocked(db.sanitaryBook.count).mockResolvedValue(5 as never);
    vi.mocked(db.review.count).mockResolvedValue(1 as never);

    const json = await (await GET(getReq(), CTX)).json();

    expect(json.admin).toEqual({ pendingSanitary: 5, disputedReviews: 1 });
    expect(json.owner).toBeUndefined();
  });
});
