import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Pin the no-Redis path: with REDIS_URL set, the route's search cache would serve
// a stale hit from another test and skip db.user.findMany, breaking the where-clause
// assertions non-deterministically.
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/core/db", () => ({
  db: {
    user: { count: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET } from "../route";

const CTX = { params: Promise.resolve({}) };

const OWNER_ID      = "owner-1";
const HEADHUNTER_ID = "hh-1";
const WAITER_ID     = "waiter-1";

const WAITER_ROW = {
  id: WAITER_ID,
  name: "Marko Marković",
  image: null,
  verificationTier: "UNVERIFIED",
  waiterPassport: {
    score: 72,
    tierRank: 0,
    skills: ["coffee"],
    languages: ["sr"],
    yearsExperience: 2,
    sanitaryBookValid: false,
    currentlyAvailable: true,
    badges: [],
    bio: null,
    reviewCount: 5,
    totalEngagements: 3,
    shareToken: null,
    passportTier: "FREE",
    subscriptionExpiresAt: null,
  },
};

function makeReq(params = "") {
  return new NextRequest(`http://localhost/api/waiters${params ? "?" + params : ""}`);
}

function mockSession(role: string, id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/waiters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.count).mockResolvedValue(1);
    vi.mocked(db.user.findMany).mockResolvedValue([WAITER_ROW] as never);
  });

  it("VENUE_OWNER gets paginated waiters", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.waiters).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
  });

  it("HEADHUNTER gets paginated waiters", async () => {
    mockSession("HEADHUNTER", HEADHUNTER_ID);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  it("WAITER → 403", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("available=true filter applied to passportFilter", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("available=true"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.waiterPassport).toMatchObject({ currentlyAvailable: true });
  });

  it("minScore filter applied", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("minScore=60"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.waiterPassport).toMatchObject({ score: { gte: 60 } });
  });

  it("skills filter applied (comma-separated)", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("skills=coffee,wine"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.waiterPassport).toMatchObject({ skills: { hasSome: ["coffee", "wine"] } });
  });

  it("search filter → name contains check", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("search=Marko"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.name).toMatchObject({ contains: "Marko" });
  });

  it("municipality filter → workMunicipalities has check", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("municipality=Vra%C4%8Dar"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.waiterPassport).toMatchObject({ workMunicipalities: { has: "Vračar" } });
  });

  it("no municipality → filter not applied", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("available=true"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as {
      where: { waiterPassport?: Record<string, unknown> };
    };
    expect(call.where.waiterPassport).not.toHaveProperty("workMunicipalities");
  });

  it("municipality combines with other passport filters", async () => {
    mockSession("HEADHUNTER", HEADHUNTER_ID);

    await GET(makeReq("municipality=Zemun&available=true"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.waiterPassport).toMatchObject({
      workMunicipalities: { has: "Zemun" },
      currentlyAvailable: true,
    });
  });

  it("verificationTier filter → ignored if invalid", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("verificationTier=INVALID_TIER"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).not.toHaveProperty("verificationTier");
  });

  it("verificationTier filter → applied if valid", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(makeReq("verificationTier=GOLD"), CTX);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.verificationTier).toBe("GOLD");
  });

  it("pagination: page=2, limit=10", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);
    vi.mocked(db.user.count).mockResolvedValue(25);

    const res = await GET(makeReq("page=2&limit=10"), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(2);
    expect(json.pages).toBe(3);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0] as { skip: number; take: number };
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
  });
});
