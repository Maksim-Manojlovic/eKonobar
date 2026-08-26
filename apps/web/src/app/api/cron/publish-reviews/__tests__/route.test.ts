import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    anonRateLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    rateLimit:     { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    review:        { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/scoring/review-lifecycle", () => ({
  publishDueReviews: vi.fn(),
}));
vi.mock("@/lib/scoring/sync", () => ({
  syncVenueTrustScore: vi.fn().mockResolvedValue(undefined),
  syncPassportScore:   vi.fn().mockResolvedValue(undefined),
}));

import { dbRaw } from "@/lib/core/db";
import { publishDueReviews } from "@/lib/scoring/review-lifecycle";
import { syncVenueTrustScore, syncPassportScore } from "@/lib/scoring/sync";
import { GET, POST } from "../route";

const SECRET = "test-cron-secret";

function makeReq(method: "GET" | "POST", auth?: string) {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers["authorization"] = auth;
  return new NextRequest(`http://localhost/api/cron/publish-reviews`, { method, headers });
}

describe("GET /api/cron/publish-reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([]);
    vi.mocked(publishDueReviews).mockResolvedValue(0);
  });

  it("valid secret → 200 with result", async () => {
    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ published: 0, venuesSynced: 0, waitersSynced: 0 });
  });

  it("missing auth → 401", async () => {
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("wrong secret → 401", async () => {
    const res = await GET(makeReq("GET", "Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("no CRON_SECRET env var → 401", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(401);
  });

  it("purges rate limit entries older than 24h", async () => {
    await GET(makeReq("GET", `Bearer ${SECRET}`));
    expect(vi.mocked(dbRaw.anonRateLimit.deleteMany)).toHaveBeenCalledOnce();
    expect(vi.mocked(dbRaw.rateLimit.deleteMany)).toHaveBeenCalledOnce();
  });

  it("published > 0 → fires score syncs for correct entity types", async () => {
    vi.mocked(publishDueReviews).mockResolvedValue(2);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([
      { direction: "WAITER_TO_VENUE", venueId: "v-1", subjectId: null },
      { direction: "VENUE_TO_WAITER", venueId: null, subjectId: "w-1" },
    ] as never);

    await GET(makeReq("GET", `Bearer ${SECRET}`));
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(syncVenueTrustScore)).toHaveBeenCalledWith("v-1");
    expect(vi.mocked(syncPassportScore)).toHaveBeenCalledWith("w-1");
  });

  it("published = 0 → no score syncs fired", async () => {
    vi.mocked(publishDueReviews).mockResolvedValue(0);

    await GET(makeReq("GET", `Bearer ${SECRET}`));

    expect(vi.mocked(syncVenueTrustScore)).not.toHaveBeenCalled();
    expect(vi.mocked(syncPassportScore)).not.toHaveBeenCalled();
  });

  it("GUEST_TO_WAITER direction syncs passport score", async () => {
    vi.mocked(publishDueReviews).mockResolvedValue(1);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([
      { direction: "GUEST_TO_WAITER", venueId: null, subjectId: "w-2" },
    ] as never);

    await GET(makeReq("GET", `Bearer ${SECRET}`));
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(syncPassportScore)).toHaveBeenCalledWith("w-2");
  });
});

describe("POST /api/cron/publish-reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([]);
    vi.mocked(publishDueReviews).mockResolvedValue(0);
  });

  it("valid secret → 200", async () => {
    const res = await POST(makeReq("POST", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
  });

  it("missing auth → 401", async () => {
    const res = await POST(makeReq("POST"));
    expect(res.status).toBe(401);
  });
});
