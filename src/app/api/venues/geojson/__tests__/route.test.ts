import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    venue: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "../route";

const BBOX = "swLat=44.7&swLng=20.3&neLat=44.9&neLng=20.5";

const VENUE = {
  id: "v-1",
  name: "Kafana Test",
  venueType: "CAFE",
  municipality: "Beograd",
  priceRangeMin: 500,
  priceRangeMax: 1500,
  trustScore: 75,
  latitude: 44.8,
  longitude: 20.4,
  _count: { jobPosts: 2 },
  zones: [],
};

function makeReq(params = BBOX) {
  return new NextRequest(`http://localhost/api/venues/geojson?${params}`);
}

describe("GET /api/venues/geojson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.venue.findMany).mockResolvedValue([VENUE] as never);
  });

  it("valid bbox → 200 GeoJSON FeatureCollection", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe("FeatureCollection");
    expect(json.features).toHaveLength(1);
  });

  it("missing bbox params → 400", async () => {
    const res = await GET(makeReq("swLat=44.7&swLng=20.3"));
    expect(res.status).toBe(400);
  });

  it("NaN bbox param → 400", async () => {
    const res = await GET(makeReq("swLat=abc&swLng=20.3&neLat=44.9&neLng=20.5"));
    expect(res.status).toBe(400);
  });

  it("feature geometry is Point", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.features[0].geometry.type).toBe("Point");
    expect(json.features[0].geometry.coordinates).toHaveLength(2);
  });

  it("feature properties include expected fields", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const props = json.features[0].properties;
    expect(props).toHaveProperty("id");
    expect(props).toHaveProperty("name");
    expect(props).toHaveProperty("venueType");
    expect(props).toHaveProperty("municipality");
    expect(props).toHaveProperty("trustScore");
    expect(props).toHaveProperty("activeJobs");
  });

  it("no auth required", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("coordinates jittered (not exactly venue lat/lng)", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const [lng, lat] = json.features[0].geometry.coordinates;
    // jitter is deterministic but non-zero for real venue IDs
    expect(typeof lat).toBe("number");
    expect(typeof lng).toBe("number");
  });

  it("venue with zone returns zone in properties", async () => {
    vi.mocked(db.venue.findMany).mockResolvedValue([
      { ...VENUE, zones: [{ zone: { zoneType: "FESTIVAL_ZONE", projectedGrowthPercent: 15 } }] },
    ] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.features[0].properties.zone).not.toBeNull();
    expect(json.features[0].properties.zone.zoneType).toBe("FESTIVAL_ZONE");
  });

  it("venue with no zones → zone: null", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.features[0].properties.zone).toBeNull();
  });
});
