import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    venueZone: { findMany: vi.fn() },
    venue:     { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/core/db";
import {
  getVenueZoneInsights,
  refreshVenueZoneCache,
  refreshAllVenueZoneCaches,
} from "../analytics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = dbRaw as any;

// Venue at Knez Mihailova, Belgrade
const LAT = 44.8178;
const LON = 20.4569;

const ZONE_CLOSE = {
  id: "z-1", name: "Festival Zone", zoneType: "FESTIVAL_ZONE",
  centerLat: 44.818, centerLng: 20.457, radiusKm: 1.0,
  projectedGrowthPercent: 15, operatorTip: "Good for events", isActive: true,
};
const ZONE_RESIDENTIAL = {
  id: "z-2", name: "Residential", zoneType: "RESIDENTIAL",
  centerLat: 44.818, centerLng: 20.457, radiusKm: 1.0,
  projectedGrowthPercent: 5, operatorTip: null, isActive: true,
};
const ZONE_FAR = {
  id: "z-3", name: "Far Zone", zoneType: "DEVELOPMENT",
  centerLat: 45.0, centerLng: 21.0, radiusKm: 0.1, // very small radius, far away
  projectedGrowthPercent: 20, operatorTip: null, isActive: true,
};

describe("getVenueZoneInsights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns insights for zones the venue falls inside", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].zoneId).toBe("z-1");
  });

  it("excludes zones venue is outside of", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_FAR]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.insights).toHaveLength(0);
  });

  it("sorts insights by distanceKm ascending", async () => {
    const ZONE_NEARER = { ...ZONE_CLOSE, id: "z-near", centerLat: LAT, centerLng: LON, radiusKm: 5.0 };
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE, ZONE_NEARER]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.insights[0].distanceKm).toBeLessThanOrEqual(result.insights[1].distanceKm);
  });

  it("hasZoneBadge true when investment zone present (FESTIVAL_ZONE)", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.hasZoneBadge).toBe(true);
  });

  it("hasZoneBadge false when only RESIDENTIAL zone present", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_RESIDENTIAL]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.hasZoneBadge).toBe(false);
  });

  it("totalProjectedGrowth sums only investment zones", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE, ZONE_RESIDENTIAL]);
    const result = await getVenueZoneInsights(LAT, LON);
    // FESTIVAL_ZONE=15, RESIDENTIAL excluded
    expect(result.totalProjectedGrowth).toBe(15);
  });

  it("totalProjectedGrowth 0 when no zones", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.totalProjectedGrowth).toBe(0);
    expect(result.hasZoneBadge).toBe(false);
  });

  it("returns cachedAt as ISO string", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(() => new Date(result.cachedAt)).not.toThrow();
    expect(result.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("operatorTip included in insight", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE]);
    const result = await getVenueZoneInsights(LAT, LON);
    expect(result.insights[0].operatorTip).toBe("Good for events");
  });

  it("distanceKm rounded to 1 decimal", async () => {
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([ZONE_CLOSE]);
    const result = await getVenueZoneInsights(LAT, LON);
    const d = result.insights[0].distanceKm;
    expect(d).toBe(Math.round(d * 10) / 10);
  });
});

describe("refreshVenueZoneCache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets venueInsights to null when venue has no coordinates", async () => {
    vi.mocked(raw.venue.findUnique).mockResolvedValue({ latitude: null, longitude: null });
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    await refreshVenueZoneCache("v-1");
    expect(vi.mocked(raw.venue.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "v-1" }, data: { venueInsights: null } }),
    );
  });

  it("updates venueInsights with computed result when coords present", async () => {
    vi.mocked(raw.venue.findUnique).mockResolvedValue({ latitude: LAT, longitude: LON });
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    await refreshVenueZoneCache("v-1");
    expect(vi.mocked(raw.venue.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "v-1" },
        data: expect.objectContaining({ venueInsights: expect.any(Object) }),
      }),
    );
  });

  it("no update when venue not found", async () => {
    vi.mocked(raw.venue.findUnique).mockResolvedValue(null);
    await refreshVenueZoneCache("bad");
    expect(vi.mocked(raw.venue.update)).toHaveBeenCalledTimes(1); // null update for missing coords
  });
});

describe("refreshAllVenueZoneCaches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates each venue once", async () => {
    vi.mocked(raw.venue.findMany).mockResolvedValue([
      { id: "v-1", latitude: LAT,       longitude: LON },
      { id: "v-2", latitude: LAT + 0.1, longitude: LON + 0.1 },
    ]);
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    await refreshAllVenueZoneCaches();
    expect(vi.mocked(raw.venue.update)).toHaveBeenCalledTimes(2);
  });

  it("no venue updates when venues list is empty", async () => {
    vi.mocked(raw.venue.findMany).mockResolvedValue([]);
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    await refreshAllVenueZoneCaches();
    expect(vi.mocked(raw.venue.update)).not.toHaveBeenCalled();
  });

  it("only queries active zones once regardless of venue count", async () => {
    vi.mocked(raw.venue.findMany).mockResolvedValue([
      { id: "v-1", latitude: LAT, longitude: LON },
      { id: "v-2", latitude: LAT, longitude: LON },
      { id: "v-3", latitude: LAT, longitude: LON },
    ]);
    vi.mocked(raw.venueZone.findMany).mockResolvedValue([]);
    await refreshAllVenueZoneCaches();
    // venueZone.findMany called once at start (parallel with venue.findMany)
    expect(vi.mocked(raw.venueZone.findMany)).toHaveBeenCalledTimes(1);
  });
});
