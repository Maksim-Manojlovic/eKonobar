import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    jobPost: { findMany: vi.fn() },
  },
}));
vi.mock("@prisma/client", () => ({
  EngagementType: {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    SEASONAL:  "SEASONAL",
    ONE_TIME:  "ONE_TIME",
  },
}));

import { db } from "@/lib/db";
import { GET } from "../route";

const BBOX = "swLat=44.7&swLng=20.3&neLat=44.9&neLng=20.5";

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

describe("GET /api/jobs/geojson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.jobPost.findMany).mockResolvedValue([JOB] as never);
  });

  it("valid bbox → 200 GeoJSON FeatureCollection", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe("FeatureCollection");
    expect(json.features).toHaveLength(1);
  });

  it("missing bbox → 400", async () => {
    const res = await GET(makeReq("swLat=44.7&swLng=20.3"));
    expect(res.status).toBe(400);
  });

  it("NaN param → 400", async () => {
    const res = await GET(makeReq("swLat=x&swLng=20.3&neLat=44.9&neLng=20.5"));
    expect(res.status).toBe(400);
  });

  it("feature geometry is Point", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.features[0].geometry.type).toBe("Point");
  });

  it("feature properties include job and venue data", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const props = json.features[0].properties;
    expect(props.id).toBe("j-1");
    expect(props.title).toBe("Konobar");
    expect(props.venue.id).toBe("v-1");
  });

  it("redAlert=true filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&redAlert=true`));
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ redAlert: true }),
      }),
    );
  });

  it("redAlert=false → redAlert filter not applied (undefined)", async () => {
    await GET(makeReq(BBOX));
    const calls = vi.mocked(db.jobPost.findMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = (calls[0] as any)[0].where as Record<string, unknown>;
    expect(where.redAlert).toBeUndefined();
  });

  it("valid engagementType filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&engagementType=FULL_TIME`));
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ engagementType: "FULL_TIME" }),
      }),
    );
  });

  it("sanitaryRequired=true filter passed to query", async () => {
    await GET(makeReq(`${BBOX}&sanitaryRequired=true`));
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sanitaryRequired: true }),
      }),
    );
  });

  it("no auth required", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });
});
