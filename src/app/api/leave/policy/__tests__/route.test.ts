import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:       { findUnique: vi.fn() },
    venueStaff:  { findUnique: vi.fn() },
    leavePolicy: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET, PATCH } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;
const CTX = { params: Promise.resolve({}) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};
const CAFE = { ...RESTAURANT, venueType: "CAFE" };

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

const getReq = (q = "?venueId=venue-1") =>
  new NextRequest(`http://localhost/api/leave/policy${q}`);

const patchReq = (body: object) =>
  new NextRequest("http://localhost/api/leave/policy", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
  mdb.venueStaff.findUnique.mockResolvedValue(null);
  mdb.leavePolicy.findMany.mockResolvedValue([]);
  mdb.leavePolicy.upsert.mockImplementation(
    async ({ create, update }: { create: object; update: object }) => ({
      id: "p1", venueId: "venue-1", department: "FOH",
      annualDays: 26, maxConcurrentOff: 2, minNoticeDays: 14,
      autoApprove: true, countWeekends: true,
      allowCarryOver: true, carryOverDays: 5, carryOverDeadline: "06-30",
      createdAt: new Date(), updatedAt: new Date(),
      ...create, ...update,
    }),
  );
});

describe("GET /api/leave/policy", () => {
  it("404s for an unknown venue", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(null);
    expect((await GET(getReq(), CTX)).status).toBe(404);
  });

  it("403s for someone with no relationship to the venue", async () => {
    mockSession("WAITER", "stranger");
    expect((await GET(getReq(), CTX)).status).toBe(403);
  });

  it("returns working defaults when nothing has been configured", async () => {
    // The feature must do something sensible before any setup.
    mockSession();
    const body = await (await GET(getReq(), CTX)).json();

    const foh = body.policies.find((p: { department: string }) => p.department === "FOH");
    expect(foh.configured).toBe(false);
    expect(foh.annualDays).toBe(26);
    expect(foh.maxConcurrentOff).toBe(2);
    expect(foh.autoApprove).toBe(true);
  });

  it("returns one policy per department for a restaurant", async () => {
    mockSession();
    const body = await (await GET(getReq(), CTX)).json();
    expect(body.policies.map((p: { department: string }) => p.department)).toEqual(["FOH", "BOH"]);
    expect(body.hasKitchen).toBe(true);
  });

  it("returns FOH only for a venue with no kitchen", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(CAFE);
    const body = await (await GET(getReq(), CTX)).json();
    expect(body.policies.map((p: { department: string }) => p.department)).toEqual(["FOH"]);
    expect(body.hasKitchen).toBe(false);
  });

  it("prefers stored values over defaults", async () => {
    mockSession();
    mdb.leavePolicy.findMany.mockResolvedValue([{
      id: "p1", venueId: "venue-1", department: "FOH",
      annualDays: 20, maxConcurrentOff: 5, minNoticeDays: 3,
      autoApprove: false, countWeekends: false,
      allowCarryOver: false, carryOverDays: 0, carryOverDeadline: "03-31",
      createdAt: new Date(), updatedAt: new Date(),
    }]);

    const body = await (await GET(getReq(), CTX)).json();
    const foh = body.policies.find((p: { department: string }) => p.department === "FOH");
    expect(foh).toMatchObject({ configured: true, annualDays: 20, autoApprove: false });
  });

  it("lets a head chef read, scoped to their own department", async () => {
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    const body = await (await GET(getReq(), CTX)).json();
    expect(body.policies.map((p: { department: string }) => p.department)).toEqual(["BOH"]);
    expect(body.canManagePolicy).toBe(false);
  });

  it("lets rank-and-file staff read their own department", async () => {
    mockSession("WAITER", "cook-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "BOH", status: "ACTIVE" });

    const body = await (await GET(getReq(), CTX)).json();
    expect(body.policies.map((p: { department: string }) => p.department)).toEqual(["BOH"]);
    expect(body.canManagePolicy).toBe(false);
  });

  it("403s an ex-employee", async () => {
    mockSession("WAITER", "gone-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "FOH", status: "ENDED" });
    expect((await GET(getReq(), CTX)).status).toBe(403);
  });

  it("400s without a venueId", async () => {
    mockSession();
    expect((await GET(getReq(""), CTX)).status).toBe(400);
  });
});

describe("PATCH /api/leave/policy", () => {
  const BASE = { venueId: "venue-1", department: "FOH" };

  it("403s a head waiter — policy is the owner's decision", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    expect((await PATCH(patchReq({ ...BASE, annualDays: 30 }), CTX)).status).toBe(403);
    expect(mdb.leavePolicy.upsert).not.toHaveBeenCalled();
  });

  it("upserts the department's policy", async () => {
    mockSession();
    const res = await PATCH(patchReq({ ...BASE, annualDays: 30, autoApprove: false }), CTX);
    expect(res.status).toBe(200);
    expect(mdb.leavePolicy.upsert.mock.calls[0][0]).toMatchObject({
      where: { venueId_department: { venueId: "venue-1", department: "FOH" } },
      update: { annualDays: 30, autoApprove: false },
    });
  });

  it("rejects a BOH policy at a venue with no kitchen", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(CAFE);
    const res = await PATCH(patchReq({ ...BASE, department: "BOH", annualDays: 30 }), CTX);
    expect(res.status).toBe(400);
    expect(mdb.leavePolicy.upsert).not.toHaveBeenCalled();
  });

  it("zeroes carryOverDays when carry-over is switched off", async () => {
    // Otherwise a stale carryOverDays keeps granting days the venue disabled.
    mockSession();
    await PATCH(patchReq({ ...BASE, allowCarryOver: false }), CTX);
    expect(mdb.leavePolicy.upsert.mock.calls[0][0].update).toMatchObject({
      allowCarryOver: false, carryOverDays: 0,
    });
  });

  it("respects an explicit carryOverDays alongside disabling carry-over", async () => {
    mockSession();
    await PATCH(patchReq({ ...BASE, allowCarryOver: false, carryOverDays: 3 }), CTX);
    expect(mdb.leavePolicy.upsert.mock.calls[0][0].update.carryOverDays).toBe(3);
  });

  it("rejects a malformed carryOverDeadline", async () => {
    mockSession();
    expect((await PATCH(patchReq({ ...BASE, carryOverDeadline: "30 June" }), CTX)).status).toBe(400);
  });

  it("rejects out-of-range numbers", async () => {
    mockSession();
    expect((await PATCH(patchReq({ ...BASE, annualDays: -1 }), CTX)).status).toBe(400);
    expect((await PATCH(patchReq({ ...BASE, annualDays: 9999 }), CTX)).status).toBe(400);
  });

  it("allows maxConcurrentOff of 0 — a venue where nobody may be off by default", async () => {
    mockSession();
    const res = await PATCH(patchReq({ ...BASE, maxConcurrentOff: 0 }), CTX);
    expect(res.status).toBe(200);
    expect(mdb.leavePolicy.upsert.mock.calls[0][0].update.maxConcurrentOff).toBe(0);
  });
});
