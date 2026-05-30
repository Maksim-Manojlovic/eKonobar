import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";

vi.mock("next-auth",          () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",  () => ({ authOptions: {} }));

// Unit tests mocked db — upsert semantics, real token format, 30-day expiry,
// and the public endpoint's 410 time-check were never executed.

import { getServerSession } from "next-auth";
import { POST } from "../route";
import { GET } from "../../public/[shareToken]/route";

function mockWaiter(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "WAITER" },
  } as never);
}

function makePost() {
  return new NextRequest("http://localhost/api/passport/share", { method: "POST" });
}

function makePublicGet(token: string) {
  return new NextRequest(`http://localhost/api/passport/public/${token}`);
}

function makePublicCtx(token: string) {
  return { params: Promise.resolve({ shareToken: token }) };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("POST /api/passport/share — integration", () => {
  it("generates token and sets shareToken + shareTokenExpiry on passport", async () => {
    const userId = await seedUser({ role: "WAITER" });
    await dbRaw.waiterPassport.create({ data: { userId } });
    mockWaiter(userId);

    const res = await POST(makePost());
    expect(res.status).toBe(200);
    const { shareToken, shareTokenExpiry } = await res.json();

    expect(shareToken).toBeTruthy();
    // base64url: alphanumeric + - and _
    expect(shareToken).toMatch(/^[A-Za-z0-9_-]+$/);

    // expiry ~30 days from now
    const exp = new Date(shareTokenExpiry).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(exp).toBeGreaterThan(Date.now() + thirtyDaysMs - 5_000);
    expect(exp).toBeLessThan(Date.now() + thirtyDaysMs + 5_000);

    // written to DB
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.shareToken).toBe(shareToken);
    expect(passport!.shareTokenExpiry).not.toBeNull();
  });

  it("upsert CREATE path: generates passport row when none exists", async () => {
    const userId = await seedUser({ role: "WAITER" });
    // No passport created
    mockWaiter(userId);

    const res = await POST(makePost());
    expect(res.status).toBe(200);

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport).not.toBeNull();
    expect(passport!.shareToken).toBeTruthy();
  });

  it("upsert UPDATE path: subsequent POST rotates the token", async () => {
    const userId = await seedUser({ role: "WAITER" });
    await dbRaw.waiterPassport.create({ data: { userId } });
    mockWaiter(userId);

    const { shareToken: token1 } = await (await POST(makePost())).json();
    const { shareToken: token2 } = await (await POST(makePost())).json();

    expect(token2).not.toBe(token1); // new token each call
    // DB has only one passport row with token2
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.shareToken).toBe(token2);
  });
});

describe("GET /api/passport/public/[shareToken] — integration", () => {
  it("valid token returns passport + engagements + reviews", async () => {
    const userId  = await seedUser({ role: "WAITER", name: "Nikola" });
    const expiry  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await dbRaw.waiterPassport.create({
      data: { userId, shareToken: "valid-token-abc", shareTokenExpiry: expiry },
    });

    const res = await GET(makePublicGet("valid-token-abc"), makePublicCtx("valid-token-abc"));
    expect(res.status).toBe(200);
    const { passport, engagements, reviews } = await res.json();

    expect(passport.user.name).toBe("Nikola");
    expect(passport.shareTokenExpiry).toBeUndefined(); // stripped from response
    expect(Array.isArray(engagements)).toBe(true);
    expect(Array.isArray(reviews)).toBe(true);
  });

  it("unknown token → 404", async () => {
    const res = await GET(makePublicGet("no-such-token"), makePublicCtx("no-such-token"));
    expect(res.status).toBe(404);
  });

  it("expired token → 410", async () => {
    const userId = await seedUser({ role: "WAITER" });
    const pastExpiry = new Date(Date.now() - 1_000); // 1 second ago
    await dbRaw.waiterPassport.create({
      data: { userId, shareToken: "expired-token", shareTokenExpiry: pastExpiry },
    });

    const res = await GET(makePublicGet("expired-token"), makePublicCtx("expired-token"));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toMatch(/istekao/i);
  });

  it("shareTokenExpiry stripped from response (privacy)", async () => {
    const userId = await seedUser({ role: "WAITER" });
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await dbRaw.waiterPassport.create({
      data: { userId, shareToken: "priv-token", shareTokenExpiry: expiry },
    });

    const { passport } = await (await GET(makePublicGet("priv-token"), makePublicCtx("priv-token"))).json();
    expect(Object.keys(passport)).not.toContain("shareTokenExpiry");
  });

  it("only PUBLISHED waiter reviews included, not PENDING", async () => {
    const ownerId = await seedUser({ role: "VENUE_OWNER" });
    const userId  = await seedUser({ role: "WAITER" });
    const expiry  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await dbRaw.waiterPassport.create({
      data: { userId, shareToken: "rev-token", shareTokenExpiry: expiry },
    });

    const venue = await dbRaw.venue.create({
      data: { ownerId, name: "V", address: "A", municipality: "B", venueType: "RESTAURANT", latitude: 44.8, longitude: 20.4 },
    });

    // One PUBLISHED, one PENDING
    await dbRaw.review.create({
      data: { venueId: venue.id, subjectId: userId, direction: "VENUE_TO_WAITER", status: "PUBLISHED",
              overallRating: 80, weight: 1, publishedAt: new Date(),
              ratingPunctuality: 80, ratingSkill: 80, ratingGuestCommunication: 80,
              ratingPersonalHygiene: 80, ratingTeamwork: 80, ratingSpeed: 80 },
    });
    await dbRaw.review.create({
      data: { venueId: venue.id, subjectId: userId, direction: "VENUE_TO_WAITER", status: "PENDING",
              overallRating: 60, weight: 1 },
    });

    const { reviews } = await (await GET(makePublicGet("rev-token"), makePublicCtx("rev-token"))).json();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].overallRating).toBe(80);
  });
});
