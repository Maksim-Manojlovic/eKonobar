import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Pin the no-Redis path: a set REDIS_URL would otherwise let tier-cache read a
// real passport:tier:* key left behind by another test file and resolve the wrong tier.
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/core/db", () => ({
  db: {
    jobPost:        { findMany: vi.fn() },
    waiterPassport: { findUnique: vi.fn() },
  },
}));
// Must mirror prisma/schema.prisma exactly — the route validates against this
// enum, so a stale mock would accept values prod rejects (and vice versa).
vi.mock("@prisma/client", () => ({
  EngagementType: {
    FULL_TIME:   "FULL_TIME",
    SEASONAL:    "SEASONAL",
    WEEKEND:     "WEEKEND",
    CELEBRATION: "CELEBRATION",
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET } from "../route";

const BBOX = "swLat=44.7&swLng=20.3&neLat=44.9&neLng=20.5";
const CTX  = { params: Promise.resolve({}) };
const WAITER_ID = "waiter-1";

const JOB = {
  id: "j-1",
  title: "Konobar",
  engagementType: "FULL_TIME",
  tipSystem: true,
  salaryMin: 60000,
  salaryMax: 80000,
  sanitaryRequired: false,
  redAlert: false,
  redAlertNote: null,
  startDate: null,
  venue: {
    id: "v-1",
    name: "Kafana Test",
    municipality: "Beograd",
    venueType: "CAFE",
    latitude: 44.8,
    longitude: 20.4,
    trustScore: 75,
  },
};

function makeReq(params = BBOX) {
  return new NextRequest(`http://localhost/api/jobs/geojson?${params}`);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

function mockWaiter(passportTier: string, subscriptionExpiresAt: Date | null) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: WAITER_ID, role: "WAITER" },
  } as never);
  vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
    passportTier,
    subscriptionExpiresAt,
  } as never);
}

/** The Red Alert visibility clauses the route composes under AND. */
function redAlertClause(): unknown[] {
  const call = vi.mocked(db.jobPost.findMany).mock.calls[0][0] as {
    where: { AND?: unknown[] };
  };
  return call.where.AND ?? [];
}

const ACTIVE_SUB  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const EXPIRED_SUB = new Date(Date.now() - 1000);

describe("GET /api/jobs/geojson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.jobPost.findMany).mockResolvedValue([JOB] as never);
    mockNoSession();
  });

  it("valid bbox → 200 GeoJSON FeatureCollection", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe("FeatureCollection");
    expect(json.features).toHaveLength(1);
  });

  it("missing bbox → 400", async () => {
    const res = await GET(makeReq("swLat=44.7&swLng=20.3"), CTX);
    expect(res.status).toBe(400);
  });

  it("NaN param → 400", async () => {
    const res = await GET(makeReq("swLat=x&swLng=20.3&neLat=44.9&neLng=20.5"), CTX);
    expect(res.status).toBe(400);
  });

  it("feature geometry is Point", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.features[0].geometry.type).toBe("Point");
  });

  it("feature properties include job and venue data", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    const props = json.features[0].properties;
    expect(props.id).toBe("j-1");
    expect(props.title).toBe("Konobar");
    expect(props.venue.id).toBe("v-1");
  });

  it("redAlert=true filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&redAlert=true`), CTX);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ redAlert: true }),
      }),
    );
  });

  it("redAlert=false → redAlert filter not applied (undefined)", async () => {
    await GET(makeReq(BBOX), CTX);
    const calls = vi.mocked(db.jobPost.findMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = (calls[0] as any)[0].where as Record<string, unknown>;
    expect(where.redAlert).toBeUndefined();
  });

  it("valid engagementType filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&engagementType=FULL_TIME`), CTX);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ engagementType: "FULL_TIME" }),
      }),
    );
  });

  it("sanitaryRequired=true filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&sanitaryRequired=true`), CTX);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sanitaryRequired: true }),
      }),
    );
  });

  it("no auth required", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  // ── bbox validation ───────────────────────────────────────────────────────

  it("inverted bbox (swLat north of neLat) → 400", async () => {
    const res = await GET(makeReq("swLat=44.9&swLng=20.3&neLat=44.7&neLng=20.5"), CTX);
    expect(res.status).toBe(400);
  });

  it("out-of-range latitude → 400", async () => {
    const res = await GET(makeReq("swLat=-91&swLng=20.3&neLat=44.9&neLng=20.5"), CTX);
    expect(res.status).toBe(400);
  });

  it("unknown engagementType → 400 rather than a silently ignored filter", async () => {
    const res = await GET(makeReq(`${BBOX}&engagementType=NOT_A_TYPE`), CTX);
    expect(res.status).toBe(400);
    expect(vi.mocked(db.jobPost.findMany)).not.toHaveBeenCalled();
  });

  it.each(["FULL_TIME", "SEASONAL", "WEEKEND", "CELEBRATION"])(
    "%s is accepted (mirrors the schema enum)",
    async (type) => {
      const res = await GET(makeReq(`${BBOX}&engagementType=${type}`), CTX);
      expect(res.status).toBe(200);
    },
  );

  it("sanitaryRequired=false filters to posts not requiring a sanitary book", async () => {
    await GET(makeReq(`${BBOX}&sanitaryRequired=false`), CTX);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sanitaryRequired: false }),
      }),
    );
  });

  it("bbox is applied to the venue relation", async () => {
    await GET(makeReq(), CTX);
    const call = vi.mocked(db.jobPost.findMany).mock.calls[0][0] as {
      where: { venue: Record<string, unknown> };
    };
    expect(call.where.venue).toMatchObject({
      isActive: true,
      latitude:  { gte: 44.7, lte: 44.9 },
      longitude: { gte: 20.3, lte: 20.5 },
    });
  });

  // ── Red Alert early access (paid PRO/PRO_PLUS feature) ────────────────────

  it("unauthenticated → Red Alert delay applied", async () => {
    await GET(makeReq(), CTX);
    expect(redAlertClause()).toEqual([
      { OR: [{ redAlert: false }, { redAlert: true, createdAt: { lte: expect.any(Date) } }] },
    ]);
  });

  it("FREE waiter → Red Alert delay applied", async () => {
    mockWaiter("FREE", null);
    await GET(makeReq(), CTX);
    expect(redAlertClause()).toHaveLength(1);
  });

  it("PRO waiter → no Red Alert delay", async () => {
    mockWaiter("PRO", ACTIVE_SUB);
    await GET(makeReq(), CTX);
    expect(redAlertClause()).toEqual([]);
  });

  it("PRO_PLUS waiter → no Red Alert delay", async () => {
    mockWaiter("PRO_PLUS", ACTIVE_SUB);
    await GET(makeReq(), CTX);
    expect(redAlertClause()).toEqual([]);
  });

  it("expired PRO passport treated as FREE → delay applied", async () => {
    mockWaiter("PRO", EXPIRED_SUB);
    await GET(makeReq(), CTX);
    expect(redAlertClause()).toHaveLength(1);
  });

  it("cutoff is RED_ALERT_DELAY_MS in the past", async () => {
    const DELAY = 30 * 60 * 1000;
    const before = Date.now();
    await GET(makeReq(), CTX);
    const after = Date.now();
    const clause = redAlertClause() as [
      { OR: [unknown, { redAlert: true; createdAt: { lte: Date } }] },
    ];
    const cutoff = clause[0].OR[1].createdAt.lte.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - DELAY);
    expect(cutoff).toBeLessThanOrEqual(after - DELAY);
  });

  // ── Cache must never be shared across entitlement ─────────────────────────

  it("delayed set (unauthenticated) is CDN-cacheable", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("undelayed PRO set is never shared-cached", async () => {
    mockWaiter("PRO", ACTIVE_SUB);
    const res = await GET(makeReq(), CTX);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("private");
    expect(cc).not.toContain("public");
  });
});
