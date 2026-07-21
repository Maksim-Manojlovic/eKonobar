import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:      { findUnique: vi.fn(), update: vi.fn() },
    venueStaff: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { PATCH } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;

const CTX = { params: Promise.resolve({ id: "venue-1", staffId: "staff-1" }) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};

const STAFF_ROW = {
  id: "staff-1", venueId: "venue-1", waiterId: "waiter-1",
  position: "WAITER", status: "ACTIVE",
};

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function patchReq(body: object) {
  return new NextRequest("http://localhost/api/venues/venue-1/staff/staff-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** What venueStaff.update was called with. */
const updateData = () => mdb.venueStaff.update.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  mdb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mdb));
  mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
  mdb.venueStaff.findUnique.mockResolvedValue(STAFF_ROW);
  mdb.venueStaff.findFirst.mockResolvedValue(null);
  mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "WAITER" });
});

describe("PATCH /api/venues/[id]/staff/[staffId]", () => {
  it("403s for a non-owner", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    expect((await PATCH(patchReq({ notes: "x" }), CTX)).status).toBe(403);
    expect(mdb.venueStaff.update).not.toHaveBeenCalled();
  });

  it("404s when the staff row belongs to another venue", async () => {
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF_ROW, venueId: "venue-2" });

    expect((await PATCH(patchReq({ notes: "x" }), CTX)).status).toBe(404);
    expect(mdb.venueStaff.update).not.toHaveBeenCalled();
  });

  it("recomputes department when the position changes", async () => {
    mockSession();
    mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "PASTRY_CHEF" });

    await PATCH(patchReq({ position: "PASTRY_CHEF" }), CTX);
    expect(updateData()).toMatchObject({ position: "PASTRY_CHEF", department: "BOH" });
  });

  it("rejects moving someone to a kitchen position at a venue with no kitchen", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, venueType: "CAFE" });

    expect((await PATCH(patchReq({ position: "LINE_COOK" }), CTX)).status).toBe(400);
    expect(mdb.venueStaff.update).not.toHaveBeenCalled();
  });

  it("409s when promoting into an occupied head position", async () => {
    mockSession();
    mdb.venueStaff.findFirst.mockResolvedValue({ id: "staff-7", waiter: { name: "Ana" } });

    const res = await PATCH(patchReq({ position: "HEAD_CHEF" }), CTX);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Ana");
  });

  it("excludes the row being edited from the head-conflict check", async () => {
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF_ROW, position: "SOUS_CHEF" });
    mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "HEAD_CHEF" });

    await PATCH(patchReq({ position: "HEAD_CHEF" }), CTX);
    expect(mdb.venueStaff.findFirst.mock.calls[0][0].where.id).toEqual({ not: "staff-1" });
  });

  it("grants headChefId when promoting to head chef", async () => {
    mockSession();
    mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "HEAD_CHEF", status: "ACTIVE" });

    await PATCH(patchReq({ position: "HEAD_CHEF" }), CTX);
    expect(mdb.venue.update).toHaveBeenCalledWith({
      where: { id: "venue-1" }, data: { headChefId: "waiter-1" },
    });
  });

  it("revokes headWaiterId when the head waiter is demoted", async () => {
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF_ROW, position: "HEAD_WAITER" });
    mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "WAITER", status: "ACTIVE" });

    await PATCH(patchReq({ position: "WAITER" }), CTX);
    expect(mdb.venue.update).toHaveBeenCalledWith({
      where: { id: "venue-1" }, data: { headWaiterId: null },
    });
  });

  it("revokes management rights when a head is ended", async () => {
    // Otherwise an ex-employee keeps the ability to edit shifts.
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF_ROW, position: "HEAD_CHEF" });
    mdb.venueStaff.update.mockResolvedValue({ ...STAFF_ROW, position: "HEAD_CHEF", status: "ENDED" });

    await PATCH(patchReq({ status: "ENDED" }), CTX);
    expect(mdb.venue.update).toHaveBeenCalledWith({
      where: { id: "venue-1" }, data: { headChefId: null },
    });
  });

  it("stamps endedAt when ending without an explicit date", async () => {
    mockSession();
    await PATCH(patchReq({ status: "ENDED" }), CTX);
    expect(updateData().endedAt).toBeInstanceOf(Date);
  });

  it("honours an explicit endedAt", async () => {
    mockSession();
    await PATCH(patchReq({ status: "ENDED", endedAt: "2026-03-01" }), CTX);
    expect(updateData().endedAt).toEqual(new Date("2026-03-01"));
  });

  it("clears endedAt when reactivating", async () => {
    mockSession();
    mdb.venueStaff.findUnique.mockResolvedValue({ ...STAFF_ROW, status: "ENDED" });

    await PATCH(patchReq({ status: "ACTIVE" }), CTX);
    expect(updateData().endedAt).toBeNull();
  });

  it("rejects an unparseable end date", async () => {
    mockSession();
    expect((await PATCH(patchReq({ endedAt: "yesterday-ish" }), CTX)).status).toBe(400);
  });

  it("leaves untouched fields out of the update", async () => {
    mockSession();
    await PATCH(patchReq({ notes: "Radi vikendom" }), CTX);

    const data = updateData();
    expect(data).toEqual({ notes: "Radi vikendom" });
    expect(mdb.venue.update).not.toHaveBeenCalled();
  });
});
