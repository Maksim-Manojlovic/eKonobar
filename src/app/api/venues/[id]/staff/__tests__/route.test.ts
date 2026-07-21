import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:      { findUnique: vi.fn(), update: vi.fn() },
    venueStaff: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user:       { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET, POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;

const CTX = { params: Promise.resolve({ id: "venue-1" }) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};
const CAFE = { ...RESTAURANT, venueType: "CAFE" };

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function getReq(query = "") {
  return new NextRequest(`http://localhost/api/venues/venue-1/staff${query}`);
}

function postReq(body: object) {
  return new NextRequest("http://localhost/api/venues/venue-1/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  waiterId: "waiter-1",
  position: "WAITER",
  employmentType: "FULL_TIME",
  startedAt: "2026-01-15",
};

beforeEach(() => {
  vi.clearAllMocks();
  mdb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mdb));
  mdb.venueStaff.create.mockResolvedValue({ id: "staff-1", position: "WAITER" });
  mdb.venueStaff.findMany.mockResolvedValue([]);
  mdb.venueStaff.findUnique.mockResolvedValue(null);
  mdb.venueStaff.findFirst.mockResolvedValue(null);
  mdb.user.findUnique.mockResolvedValue({ id: "waiter-1", role: "WAITER" });
});

describe("GET /api/venues/[id]/staff", () => {
  it("404s for an unknown venue", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(null);
    expect((await GET(getReq(), CTX)).status).toBe(404);
  });

  it("403s for a user who neither owns nor heads the venue", async () => {
    mockSession("VENUE_OWNER", "someone-else");
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    expect((await GET(getReq(), CTX)).status).toBe(403);
  });

  it("403s for an unrelated waiter", async () => {
    mockSession("WAITER", "waiter-9");
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    expect((await GET(getReq(), CTX)).status).toBe(403);
  });

  it("lets the owner read the whole roster and reports canManage", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    const res = await GET(getReq(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(true);
    expect(body.hasKitchen).toBe(true);
    // No department filter for the owner.
    expect(mdb.venueStaff.findMany.mock.calls[0][0].where.department).toBeUndefined();
  });

  it("reports hasKitchen false for a café", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(CAFE);
    const body = await (await GET(getReq(), CTX)).json();
    expect(body.hasKitchen).toBe(false);
  });

  it("scopes a head chef to BOH and marks them read-only", async () => {
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    const body = await (await GET(getReq(), CTX)).json();
    expect(body.canManage).toBe(false);
    expect(mdb.venueStaff.findMany.mock.calls[0][0].where.department).toBe("BOH");
  });

  it("scopes a head waiter to FOH even when they ask for BOH", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    await GET(getReq("?department=BOH"), CTX);
    expect(mdb.venueStaff.findMany.mock.calls[0][0].where.department).toBe("FOH");
  });

  it("hides ended staff unless asked", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    await GET(getReq(), CTX);
    expect(mdb.venueStaff.findMany.mock.calls[0][0].where.status).toEqual({ not: "ENDED" });

    await GET(getReq("?includeEnded=true"), CTX);
    expect(mdb.venueStaff.findMany.mock.calls[1][0].where.status).toBeUndefined();
  });
});

describe("POST /api/venues/[id]/staff", () => {
  it("403s for a non-owner, including a head waiter", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    expect((await POST(postReq(VALID_BODY), CTX)).status).toBe(403);
    expect(mdb.venueStaff.create).not.toHaveBeenCalled();
  });

  it("creates a roster row with the department derived from the position", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    const res = await POST(postReq({ ...VALID_BODY, position: "LINE_COOK" }), CTX);
    expect(res.status).toBe(201);
    expect(mdb.venueStaff.create.mock.calls[0][0].data).toMatchObject({
      venueId: "venue-1", waiterId: "waiter-1", position: "LINE_COOK", department: "BOH",
    });
  });

  it("rejects a kitchen position at a venue with no kitchen", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(CAFE);

    const res = await POST(postReq({ ...VALID_BODY, position: "HEAD_CHEF" }), CTX);
    expect(res.status).toBe(400);
    expect(mdb.venueStaff.create).not.toHaveBeenCalled();
  });

  it("allows a kitchen position when kitchenEnabled overrides the venue type", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue({ ...CAFE, kitchenEnabled: true });

    expect((await POST(postReq({ ...VALID_BODY, position: "LINE_COOK" }), CTX)).status).toBe(201);
  });

  it("409s when the waiter is already on the roster", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    mdb.venueStaff.findUnique.mockResolvedValue({ id: "staff-9", status: "ACTIVE" });

    const res = await POST(postReq(VALID_BODY), CTX);
    expect(res.status).toBe(409);
    expect(mdb.venueStaff.create).not.toHaveBeenCalled();
  });

  it("404s when the target user is not a waiter", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    mdb.user.findUnique.mockResolvedValue({ id: "waiter-1", role: "HEADHUNTER" });

    expect((await POST(postReq(VALID_BODY), CTX)).status).toBe(404);
  });

  it("rejects an unparseable start date", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    const res = await POST(postReq({ ...VALID_BODY, startedAt: "not-a-date" }), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects an unknown position", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    const res = await POST(postReq({ ...VALID_BODY, position: "PIZZA_WIZARD" }), CTX);
    expect(res.status).toBe(400);
  });

  it("promotes a head chef onto Venue.headChefId", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    mdb.venueStaff.create.mockResolvedValue({ id: "staff-1", position: "HEAD_CHEF" });

    await POST(postReq({ ...VALID_BODY, position: "HEAD_CHEF" }), CTX);
    expect(mdb.venue.update).toHaveBeenCalledWith({
      where: { id: "venue-1" }, data: { headChefId: "waiter-1" },
    });
  });

  it("promotes a head waiter onto Venue.headWaiterId, not headChefId", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    mdb.venueStaff.create.mockResolvedValue({ id: "staff-1", position: "HEAD_WAITER" });

    await POST(postReq({ ...VALID_BODY, position: "HEAD_WAITER" }), CTX);
    expect(mdb.venue.update).toHaveBeenCalledWith({
      where: { id: "venue-1" }, data: { headWaiterId: "waiter-1" },
    });
  });

  it("409s when the department already has a head", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
    mdb.venueStaff.findFirst.mockResolvedValue({ id: "staff-7", waiter: { name: "Marko" } });

    const res = await POST(postReq({ ...VALID_BODY, position: "HEAD_CHEF" }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Marko");
    expect(mdb.venueStaff.create).not.toHaveBeenCalled();
  });

  it("does not run the head check for a non-head position", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(RESTAURANT);

    await POST(postReq(VALID_BODY), CTX);
    expect(mdb.venueStaff.findFirst).not.toHaveBeenCalled();
    expect(mdb.venue.update).not.toHaveBeenCalled();
  });
});
