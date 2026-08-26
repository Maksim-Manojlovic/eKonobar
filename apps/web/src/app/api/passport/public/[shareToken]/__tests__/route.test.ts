import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  db: {
    waiterPassport:   { findUnique: vi.fn() },
    engagementRecord: { findMany: vi.fn() },
    review:           { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { GET } from "../route";

const TOKEN     = "valid-token-abc123";
const WAITER_ID = "waiter-1";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 1000);

const BASE_PASSPORT = {
  id: "pp-1",
  userId: WAITER_ID,
  score: 78,
  badges: [],
  reviewCount: 5,
  totalEngagements: 3,
  avgEngagementMonths: 4,
  skills: ["coffee"],
  languages: ["sr"],
  yearsExperience: 2,
  sanitaryBookValid: true,
  sanitaryExpiry: null,
  currentlyAvailable: true,
  bio: "Test bio",
  profilePhoto: null,
  galleryPhotos: [],
  venueTypePreferences: [],
  avgRedAlertResponseMinutes: null,
  redAlertResponseCount: 0,
  lastAvailableDate: null,
  passportTier: "FREE",
  createdAt: new Date(),
  shareTokenExpiry: FUTURE,
  trustScore: null,
  user: {
    id: WAITER_ID,
    name: "Marko",
    image: null,
    verificationTier: "UNVERIFIED",
    createdAt: new Date(),
  },
};

function makeCtx(token = TOKEN) {
  return { params: Promise.resolve({ shareToken: token }) };
}

describe("GET /api/passport/public/[shareToken]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(BASE_PASSPORT as never);
    vi.mocked(db.engagementRecord.findMany).mockResolvedValue([]);
    vi.mocked(db.review.findMany).mockResolvedValue([]);
  });

  it("valid token → 200 with passport, engagements, reviews", async () => {
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.passport).toBeDefined();
    expect(json.engagements).toEqual([]);
    expect(json.reviews).toEqual([]);
  });

  it("shareTokenExpiry stripped from response", async () => {
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    const json = await res.json();
    expect(json.passport.shareTokenExpiry).toBeUndefined();
  });

  it("token not found → 404", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost"), makeCtx("bad-token"));
    expect(res.status).toBe(404);
  });

  it("expired token → 410", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      ...BASE_PASSPORT,
      shareTokenExpiry: PAST,
    } as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(410);
  });

  it("null expiry (no expiry set) → 200 (not expired)", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      ...BASE_PASSPORT,
      shareTokenExpiry: null,
    } as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
  });

  it("engagements fetched for correct waiter", async () => {
    await GET(new NextRequest("http://localhost"), makeCtx());

    expect(vi.mocked(db.engagementRecord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { waiterId: WAITER_ID } }),
    );
  });

  it("reviews fetched with correct directions", async () => {
    await GET(new NextRequest("http://localhost"), makeCtx());

    expect(vi.mocked(db.review.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          direction: { in: ["VENUE_TO_WAITER", "GUEST_TO_WAITER"] },
        }),
      }),
    );
  });

  it("no auth required — works without session", async () => {
    // Route has no getServerSession call; any request works
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
  });
});
