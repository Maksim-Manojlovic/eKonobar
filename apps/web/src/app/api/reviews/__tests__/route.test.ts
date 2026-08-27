import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    review: { create: vi.fn() },
    venue:  { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/scoring/sync", () => ({
  syncVenueTrustScore: vi.fn().mockResolvedValue(undefined),
  syncPassportScore:   vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/core/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/geo/geofence", () => ({
  isInsideVenueRadius:   vi.fn().mockReturnValue({ allowed: true, distanceKm: 0.01, radiusKm: 0.15 }),
  createGeolocationHash: vi.fn().mockReturnValue("hash"),
  parseGuestCoordinates: vi.fn().mockReturnValue({ lat: 44.8, lon: 20.4 }),
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { POST } from "../route";

const CTX = { params: Promise.resolve({}) };

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "WAITER", id = "waiter-1") {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role, name: "Test", verificationTier: "UNVERIFIED" },
  } as never);
}

const FAKE_REVIEW = { id: "r-1", status: "PENDING" };
const FAKE_VENUE  = { ownerId: "owner-1" };

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.review.create).mockResolvedValue(FAKE_REVIEW as never);
    vi.mocked(db.venue.findUnique).mockResolvedValue(FAKE_VENUE as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq({ direction: "WAITER_TO_VENUE", venueId: "v1", overallRating: 50 }), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 400 when overallRating > 100", async () => {
    mockSession();
    const res = await POST(makeReq({ direction: "WAITER_TO_VENUE", venueId: "v1", overallRating: 150 }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 when overallRating < 0", async () => {
    mockSession();
    const res = await POST(makeReq({ direction: "WAITER_TO_VENUE", venueId: "v1", overallRating: -1 }), CTX);
    expect(res.status).toBe(400);
  });

  it("clamps category rating above 100 to 100", async () => {
    mockSession();
    await POST(makeReq({
      direction: "WAITER_TO_VENUE",
      venueId: "v1",
      overallRating: 80,
      ratingAtmosphere: 999,
    }), CTX);
    const createCall = vi.mocked(db.review.create).mock.calls[0]?.[0];
    expect(createCall?.data.ratingAtmosphere).toBe(100);
  });

  it("clamps category rating below 0 to 0", async () => {
    mockSession();
    await POST(makeReq({
      direction: "WAITER_TO_VENUE",
      venueId: "v1",
      overallRating: 80,
      ratingPay: -50,
    }), CTX);
    const createCall = vi.mocked(db.review.create).mock.calls[0]?.[0];
    expect(createCall?.data.ratingPay).toBe(0);
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockSession();
    const { checkRateLimit } = await import("@/lib/core/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    const res = await POST(makeReq({ direction: "WAITER_TO_VENUE", venueId: "v1", overallRating: 80 }), CTX);
    expect(res.status).toBe(429);
  });
});
