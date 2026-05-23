import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    venue:  { findUnique: vi.fn() },
    review: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET } from "../route";

const OWNER_ID = "owner-1";
const VENUE_ID = "venue-1";

const REVIEW = {
  id: "r-1",
  direction: "WAITER_TO_VENUE",
  status: "PUBLISHED",
  overallRating: 80,
  comment: "Great!",
  guestHandle: null,
  createdAt: new Date(),
  publishedAt: new Date(),
  pendingUntil: null,
  author: { name: "Marko", verificationTier: "UNVERIFIED" },
  subject: null,
};

function makeCtx(id = VENUE_ID) {
  return { params: Promise.resolve({ id }) };
}

function mockSession(role: string, id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/venues/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.venue.findUnique).mockResolvedValue({ ownerId: OWNER_ID } as never);
    vi.mocked(db.review.findMany).mockResolvedValue([REVIEW] as never);
  });

  it("owner gets reviews → 200", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("non-VENUE_OWNER → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(401);
  });

  it("wrong owner → 403", async () => {
    mockSession("VENUE_OWNER", "other-owner");
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(403);
  });

  it("venue not found → 404", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);
    vi.mocked(db.venue.findUnique).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(404);
  });

  it("REMOVED reviews excluded from query", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);
    await GET(new NextRequest("http://localhost"), makeCtx());

    expect(vi.mocked(db.review.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "REMOVED" } }),
      }),
    );
  });

  it("fetches WAITER_TO_VENUE, GUEST_TO_WAITER, GUEST_TO_VENUE directions", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);
    await GET(new NextRequest("http://localhost"), makeCtx());

    const call = vi.mocked(db.review.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.direction).toMatchObject({
      in: expect.arrayContaining(["WAITER_TO_VENUE", "GUEST_TO_WAITER", "GUEST_TO_VENUE"]),
    });
  });
});
