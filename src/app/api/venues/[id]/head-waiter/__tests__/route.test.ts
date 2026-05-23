import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    venue: { findFirst: vi.fn(), update: vi.fn() },
    user:  { findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { PUT, DELETE } from "../route";

const OWNER_ID  = "owner-1";
const VENUE_ID  = "venue-1";
const WAITER_ID = "waiter-1";

const VENUE  = { id: VENUE_ID, ownerId: OWNER_ID };
const WAITER = { id: WAITER_ID, name: "Marko", role: "WAITER" };

function makeCtx(id = VENUE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makePutReq(body: object) {
  return new NextRequest(`http://localhost/api/venues/${VENUE_ID}/head-waiter`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq() {
  return new NextRequest(`http://localhost/api/venues/${VENUE_ID}/head-waiter`, { method: "DELETE" });
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PUT /api/venues/[id]/head-waiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.venue.findFirst).mockResolvedValue(VENUE as never);
    vi.mocked(db.user.findFirst).mockResolvedValue(WAITER as never);
    vi.mocked(db.venue.update).mockResolvedValue({
      id: VENUE_ID, headWaiterId: WAITER_ID, headWaiter: WAITER,
    } as never);
  });

  it("owner appoints head waiter → 200", async () => {
    const res = await PUT(makePutReq({ waiterId: WAITER_ID }), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.headWaiterId).toBe(WAITER_ID);
  });

  it("missing waiterId → 400", async () => {
    const res = await PUT(makePutReq({}), makeCtx());
    expect(res.status).toBe(400);
  });

  it("non-VENUE_OWNER → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await PUT(makePutReq({ waiterId: WAITER_ID }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 403", async () => {
    mockNoSession();
    const res = await PUT(makePutReq({ waiterId: WAITER_ID }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("venue not found / wrong owner → 404", async () => {
    vi.mocked(db.venue.findFirst).mockResolvedValue(null);
    const res = await PUT(makePutReq({ waiterId: WAITER_ID }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("waiter not found → 404", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);
    const res = await PUT(makePutReq({ waiterId: "ghost" }), makeCtx());
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/venues/[id]/head-waiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.venue.findFirst).mockResolvedValue(VENUE as never);
    vi.mocked(db.venue.update).mockResolvedValue({ id: VENUE_ID, headWaiterId: null } as never);
  });

  it("owner removes head waiter → 200", async () => {
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.headWaiterId).toBeNull();
  });

  it("non-VENUE_OWNER → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 403", async () => {
    mockNoSession();
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("venue not found / wrong owner → 404", async () => {
    vi.mocked(db.venue.findFirst).mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("sets headWaiterId to null in update", async () => {
    await DELETE(makeDeleteReq(), makeCtx());
    expect(vi.mocked(db.venue.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { headWaiterId: null } }),
    );
  });
});
