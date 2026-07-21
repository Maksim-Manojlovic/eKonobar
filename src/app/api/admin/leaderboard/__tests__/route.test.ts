import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    waiterPassport:   { findMany: vi.fn() },
    venueTrustScore:  { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/core/db";
import { GET } from "../route";

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}
function makeReq() {  return new NextRequest("http://localhost");}

const CTX = { params: Promise.resolve({}) };

function setupDefaultMocks() {
  vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([
    {
      score: 87.4,
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
}

describe("GET /api/admin/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    setupDefaultMocks();
  });

  it("ADMIN gets leaderboard → 200", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("response has topWaiters and topVenues keys", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json).toHaveProperty("topWaiters");
    expect(json).toHaveProperty("topVenues");
  });

  it("no revenue key — the waiter subscription product was removed", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json).not.toHaveProperty("revenue");
  });

  it("waiter score rounded to integer", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.topWaiters[0].score).toBe(87);
  });

  it("venue score rounded to integer", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.topVenues[0].score).toBe(92);
  });
});
