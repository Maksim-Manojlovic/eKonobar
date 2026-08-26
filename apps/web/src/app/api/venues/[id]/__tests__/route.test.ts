import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    venue:  { findUnique: vi.fn(), update: vi.fn() },
    review: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET, PATCH } from "../route";

const OWNER_ID = "owner-1";
const VENUE_ID = "venue-1";

const BASE_VENUE = {
  id: VENUE_ID,
  name: "Test Venue",
  ownerId: OWNER_ID,
  venueTrustScore: null,
  _count: { jobPosts: 1, reviews: 3 },
  jobPosts: [],
  zones: [],
};

function makeCtx(id = VENUE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: object, method = "PATCH") {
  return new NextRequest(`http://localhost/api/venues/${VENUE_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role: string, id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/venues/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns venue + waiterReviews + guestReviews", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue(BASE_VENUE as never);
    // findMany called twice: waiterReviews then guestReviews
    vi.mocked(db.review.findMany)
      .mockResolvedValueOnce([{ id: "r1", overallRating: 80 }] as never)
      .mockResolvedValueOnce([{ id: "r2", overallRating: 60 }] as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(VENUE_ID);
    expect(json.waiterReviews).toHaveLength(1);
    expect(json.guestReviews).toHaveLength(1);
  });

  it("venue not found → 404", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost"), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("no auth required — works for unauthenticated", async () => {
    mockNoSession();
    vi.mocked(db.venue.findUnique).mockResolvedValue(BASE_VENUE as never);
    vi.mocked(db.review.findMany).mockResolvedValue([] as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/venues/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.venue.findUnique).mockResolvedValue({ ownerId: OWNER_ID } as never);
    vi.mocked(db.venue.update).mockResolvedValue({ id: VENUE_ID } as never);
  });

  it("owner updates venue → 200", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ description: "Nice place" }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(db.venue.update)).toHaveBeenCalledOnce();
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ description: "x" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("non-VENUE_OWNER role → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await PATCH(makeReq({ description: "x" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("wrong owner → 403", async () => {
    mockSession("VENUE_OWNER", "other-owner");
    const res = await PATCH(makeReq({ description: "x" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("venue not found → 404", async () => {
    mockSession("VENUE_OWNER");
    vi.mocked(db.venue.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ description: "x" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("images not array → 400", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ images: "not-an-array" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("images > 8 → 400", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ images: Array(9).fill("http://img.test/x.jpg") }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("invalid website scheme → 400", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ website: "ftp://badscheme.com" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("dangerous instagram scheme → 400", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ instagram: "javascript:alert(1)" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("valid https website passes", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ website: "https://example.com" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("geofenceEnabled boolean coerced", async () => {
    mockSession("VENUE_OWNER");
    await PATCH(makeReq({ geofenceEnabled: true }), makeCtx());
    expect(vi.mocked(db.venue.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ geofenceEnabled: true }) }),
    );
  });
});
