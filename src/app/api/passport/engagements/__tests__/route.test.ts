import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    engagementRecord: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET } from "../route";

function makeReq() { return new NextRequest("http://localhost/api/test"); }

const CTX = { params: Promise.resolve({}) };

const WAITER_ID = "waiter-1";

const ENGAGEMENT = {
  id: "e-1",
  venueId: "v-1",
  notes: "Great place",
  startDate: new Date("2024-01-15"),
  endDate: new Date("2024-06-30"),
  verified: true,
  engagementType: "FULL_TIME",
  venue: { id: "v-1", name: "Test Venue", venueType: "CAFE" },
};

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/passport/engagements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.engagementRecord.findMany).mockResolvedValue([ENGAGEMENT] as never);
  });

  it("WAITER gets engagements → 200", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("dates serialized as ISO strings", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json[0].startDate).toBe("2024-01-15T00:00:00.000Z");
    expect(json[0].endDate).toBe("2024-06-30T00:00:00.000Z");
  });

  it("null endDate preserved as null", async () => {
    vi.mocked(db.engagementRecord.findMany).mockResolvedValue([
      { ...ENGAGEMENT, endDate: null },
    ] as never);

    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json[0].endDate).toBeNull();
  });

  it("null notes preserved as null", async () => {
    vi.mocked(db.engagementRecord.findMany).mockResolvedValue([
      { ...ENGAGEMENT, notes: null },
    ] as never);

    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json[0].notes).toBeNull();
  });

  it("mapped output includes venueName and venueType from nested venue", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json[0].venueName).toBe("Test Venue");
    expect(json[0].venueType).toBe("CAFE");
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("queries scoped to current user", async () => {
    await GET(makeReq(), CTX);
    expect(vi.mocked(db.engagementRecord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { waiterId: WAITER_ID } }),
    );
  });
});
