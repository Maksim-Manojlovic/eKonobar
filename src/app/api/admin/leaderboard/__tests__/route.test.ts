import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    waiterPassport:   { findMany: vi.fn() },
    venueTrustScore:  { findMany: vi.fn() },
    passportPayment:  { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

function setupDefaultMocks() {
  vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([
    {
      score: 87.4,
      passportTier: "PRO",
      subscriptionExpiresAt: FUTURE,
      reviewCount: 12,
      totalEngagements: 5,
      user: { id: "w-1", name: "Marko", image: null, verificationTier: "SILVER" },
    },
  ] as never);
  vi.mocked(dbRaw.venueTrustScore.findMany).mockResolvedValue([
    {
      composite: 91.6,
      sampleSize: 30,
      venue: { id: "v-1", name: "Kafana Test", municipality: "Beograd", logo: null },
    },
  ] as never);
  vi.mocked(dbRaw.passportPayment.findMany).mockResolvedValue([
    { amountRsd: 29000, createdAt: new Date() },
  ] as never);
}

describe("GET /api/admin/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    setupDefaultMocks();
  });

  it("ADMIN gets leaderboard → 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 401", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("response has topWaiters, topVenues, revenue keys", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty("topWaiters");
    expect(json).toHaveProperty("topVenues");
    expect(json).toHaveProperty("revenue");
  });

  it("waiter score rounded to integer", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.topWaiters[0].score).toBe(87);
  });

  it("waiter isActive true when subscription in future", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.topWaiters[0].isActive).toBe(true);
  });

  it("waiter isActive false when subscription expired", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([
      {
        score: 80,
        passportTier: "PRO",
        subscriptionExpiresAt: PAST,
        reviewCount: 5,
        totalEngagements: 2,
        user: { id: "w-2", name: "Ana", image: null, verificationTier: "UNVERIFIED" },
      },
    ] as never);
    const res = await GET();
    const json = await res.json();
    expect(json.topWaiters[0].isActive).toBe(false);
  });

  it("venue score rounded to integer", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.topVenues[0].score).toBe(92);
  });

  it("revenue array has 30 entries", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.revenue).toHaveLength(30);
  });

  it("revenue entries have date and revenue fields", async () => {
    const res = await GET();
    const json = await res.json();
    const entry = json.revenue[0];
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("revenue");
    expect(typeof entry.revenue).toBe("number");
  });

  it("no payments → all revenue days are 0", async () => {
    vi.mocked(dbRaw.passportPayment.findMany).mockResolvedValue([]);
    const res = await GET();
    const json = await res.json();
    expect(json.revenue.every((d: { revenue: number }) => d.revenue === 0)).toBe(true);
  });

  it("payment amount converted ÷100", async () => {
    const res = await GET();
    const json = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = json.revenue.find((d: { date: string }) => d.date === today);
    expect(todayEntry?.revenue).toBe(290); // 29000 / 100
  });
});
