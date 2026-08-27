import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:             { findUnique: vi.fn() },
    venueStaff:        { findUnique: vi.fn() },
    venueBlackoutDate: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction:      vi.fn(),
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET, POST, DELETE } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdb = db as any;
const CTX = { params: Promise.resolve({}) };

const RESTAURANT = {
  id: "venue-1", ownerId: "owner-1", headWaiterId: null, headChefId: null,
  venueType: "RESTAURANT", kitchenEnabled: null,
};

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

const getReq = (q: string) => new NextRequest(`http://localhost/api/leave/blackouts${q}`);

const bodyReq = (method: "POST" | "DELETE", body: object) =>
  new NextRequest("http://localhost/api/leave/blackouts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Dates passed to the upserts inside the transaction, as YYYY-MM-DD. */
function upsertedDates(): string[] {
  return mdb.venueBlackoutDate.upsert.mock.calls
    .map((c: [{ create: { date: Date } }]) => c[0].create.date.toISOString().slice(0, 10));
}

const OK_RANGE = { venueId: "venue-1", department: "FOH", from: "2026-12-24", to: "2026-12-26" };

beforeEach(() => {
  vi.clearAllMocks();
  mdb.venue.findUnique.mockResolvedValue(RESTAURANT);
  mdb.venueStaff.findUnique.mockResolvedValue(null);
  mdb.venueBlackoutDate.findMany.mockResolvedValue([]);
  mdb.venueBlackoutDate.upsert.mockImplementation((args: unknown) => args);
  mdb.venueBlackoutDate.deleteMany.mockResolvedValue({ count: 0 });
  mdb.$transaction.mockResolvedValue([]);
});

describe("range validation", () => {
  it("rejects a malformed date", async () => {
    mockSession();
    const res = await GET(getReq("?venueId=venue-1&from=24.12.2026&to=2026-12-26"), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects a date that does not exist", async () => {
    mockSession();
    const res = await GET(getReq("?venueId=venue-1&from=2026-02-31&to=2026-03-01"), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects an inverted range", async () => {
    mockSession();
    const res = await GET(getReq("?venueId=venue-1&from=2026-12-26&to=2026-12-24"), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects a range beyond the cap", async () => {
    mockSession();
    const res = await GET(getReq("?venueId=venue-1&from=2026-01-01&to=2028-01-01"), CTX);
    expect(res.status).toBe(400);
  });

  it("accepts a full calendar year", async () => {
    mockSession();
    const res = await GET(getReq("?venueId=venue-1&from=2026-01-01&to=2026-12-31"), CTX);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/leave/blackouts", () => {
  const Q = "?venueId=venue-1&from=2026-12-01&to=2026-12-31";

  it("404s for an unknown venue", async () => {
    mockSession();
    mdb.venue.findUnique.mockResolvedValue(null);
    expect((await GET(getReq(Q), CTX)).status).toBe(404);
  });

  it("403s a stranger", async () => {
    mockSession("WAITER", "stranger");
    expect((await GET(getReq(Q), CTX)).status).toBe(403);
  });

  it("returns both departments to the owner", async () => {
    mockSession();
    await GET(getReq(Q), CTX);
    expect(mdb.venueBlackoutDate.findMany.mock.calls[0][0].where.department)
      .toEqual({ in: ["FOH", "BOH"] });
  });

  it("serialises dates as YYYY-MM-DD, not as timestamps", async () => {
    mockSession();
    mdb.venueBlackoutDate.findMany.mockResolvedValue([{
      id: "b1", department: "FOH", date: new Date("2026-12-31T00:00:00.000Z"),
      maxOff: 0, reason: "Doček",
    }]);

    const body = await (await GET(getReq(Q), CTX)).json();
    expect(body.blackouts[0].date).toBe("2026-12-31");
  });

  it("scopes a head chef to their own department", async () => {
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    await GET(getReq(Q), CTX);
    expect(mdb.venueBlackoutDate.findMany.mock.calls[0][0].where.department).toEqual({ in: ["BOH"] });
  });

  it("403s a head chef who asks for the other department", async () => {
    // Must not silently widen or silently narrow — an explicit out-of-scope ask is a 403.
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    expect((await GET(getReq(`${Q}&department=FOH`), CTX)).status).toBe(403);
  });

  it("lets read-only staff see their department's blocked days", async () => {
    mockSession("WAITER", "cook-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "BOH", status: "ACTIVE" });

    const body = await (await GET(getReq(Q), CTX)).json();
    expect(body.canManageBlackouts).toBe(false);
    expect(body.departments).toEqual(["BOH"]);
  });
});

describe("POST /api/leave/blackouts", () => {
  it("403s read-only staff", async () => {
    mockSession("WAITER", "cook-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "BOH", status: "ACTIVE" });

    const res = await POST(bodyReq("POST", { ...OK_RANGE, department: "BOH" }), CTX);
    expect(res.status).toBe(403);
    expect(mdb.$transaction).not.toHaveBeenCalled();
  });

  it("403s a head waiter writing to the kitchen's calendar", async () => {
    mockSession("WAITER", "hw-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headWaiterId: "hw-1" });

    expect((await POST(bodyReq("POST", { ...OK_RANGE, department: "BOH" }), CTX)).status).toBe(403);
  });

  it("lets a head chef write to their own department", async () => {
    mockSession("WAITER", "chef-1");
    mdb.venue.findUnique.mockResolvedValue({ ...RESTAURANT, headChefId: "chef-1" });

    expect((await POST(bodyReq("POST", { ...OK_RANGE, department: "BOH" }), CTX)).status).toBe(201);
  });

  it("writes one row per day, inclusive of both ends", async () => {
    mockSession();
    const res = await POST(bodyReq("POST", OK_RANGE), CTX);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ written: 3 });
    expect(upsertedDates()).toEqual(["2026-12-24", "2026-12-25", "2026-12-26"]);
  });

  it("defaults maxOff to 0 — the owner's X means everyone works", async () => {
    mockSession();
    await POST(bodyReq("POST", OK_RANGE), CTX);
    expect(mdb.venueBlackoutDate.upsert.mock.calls[0][0].create.maxOff).toBe(0);
  });

  it("stores a reduced cap rather than a full block when maxOff is given", async () => {
    mockSession();
    await POST(bodyReq("POST", { ...OK_RANGE, maxOff: 1 }), CTX);
    expect(mdb.venueBlackoutDate.upsert.mock.calls[0][0].create.maxOff).toBe(1);
  });

  it("upserts so re-blocking a day updates its cap instead of failing", async () => {
    mockSession();
    await POST(bodyReq("POST", { ...OK_RANGE, maxOff: 2 }), CTX);
    expect(mdb.venueBlackoutDate.upsert.mock.calls[0][0].update).toMatchObject({ maxOff: 2 });
  });

  it("writes only the requested weekdays", async () => {
    // "Every Friday in December" — 4, 11, 18, 25 Dec 2026 are Fridays.
    mockSession();
    const res = await POST(bodyReq("POST", {
      venueId: "venue-1", department: "FOH",
      from: "2026-12-01", to: "2026-12-31", weekdays: [5],
    }), CTX);

    expect(await res.json()).toMatchObject({ written: 4 });
    expect(upsertedDates()).toEqual(["2026-12-04", "2026-12-11", "2026-12-18", "2026-12-25"]);
  });

  it("400s when a weekday filter matches no day in the range", async () => {
    mockSession();
    const res = await POST(bodyReq("POST", { ...OK_RANGE, weekdays: [1] }), CTX);
    expect(res.status).toBe(400);
    expect(mdb.$transaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/leave/blackouts", () => {
  it("403s read-only staff", async () => {
    mockSession("WAITER", "cook-1");
    mdb.venueStaff.findUnique.mockResolvedValue({ department: "BOH", status: "ACTIVE" });

    expect((await DELETE(bodyReq("DELETE", { ...OK_RANGE, department: "BOH" }), CTX)).status).toBe(403);
    expect(mdb.venueBlackoutDate.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes across the whole range when no weekday filter is given", async () => {
    mockSession();
    await DELETE(bodyReq("DELETE", OK_RANGE), CTX);

    const where = mdb.venueBlackoutDate.deleteMany.mock.calls[0][0].where;
    expect(where.date.gte).toBeInstanceOf(Date);
    expect(where.date.lte).toBeInstanceOf(Date);
    expect(where.date.in).toBeUndefined();
  });

  it("deletes only the listed weekdays, not the whole range", async () => {
    // The bug this guards: "unblock every Friday" wiping all of December.
    mockSession();
    await DELETE(bodyReq("DELETE", {
      venueId: "venue-1", department: "FOH",
      from: "2026-12-01", to: "2026-12-31", weekdays: [5],
    }), CTX);

    const where = mdb.venueBlackoutDate.deleteMany.mock.calls[0][0].where;
    expect(where.date.gte).toBeUndefined();
    expect(where.date.in).toHaveLength(4);
    expect(where.date.in.map((d: Date) => d.toISOString().slice(0, 10)))
      .toEqual(["2026-12-04", "2026-12-11", "2026-12-18", "2026-12-25"]);
  });

  it("scopes the delete to one department", async () => {
    mockSession();
    await DELETE(bodyReq("DELETE", OK_RANGE), CTX);
    expect(mdb.venueBlackoutDate.deleteMany.mock.calls[0][0].where.department).toBe("FOH");
  });

  it("reports how many rows were removed", async () => {
    mockSession();
    mdb.venueBlackoutDate.deleteMany.mockResolvedValue({ count: 7 });
    const body = await (await DELETE(bodyReq("DELETE", OK_RANGE), CTX)).json();
    expect(body).toMatchObject({ deleted: 7, department: "FOH" });
  });
});
