import { describe, it, expect } from "vitest";
import {
  buildMapQuery, mapEndpoint, isJob, EMPTY_FILTERS,
  markerColor, legendRows, VENUE_TYPE_MARKER, ENGAGEMENT_MARKER,
} from "../map-constants";
import type { JobProps, MapFilters, VenueProps } from "../map-types";

const BBOX = { swLat: 44.7, swLng: 20.3, neLat: 44.9, neLng: 20.5 };
const f = (over: Partial<MapFilters> = {}): MapFilters => ({ ...EMPTY_FILTERS, ...over });

const params = (qs: string) => Object.fromEntries(new URLSearchParams(qs).entries());

describe("buildMapQuery", () => {
  it("always sends the bbox", () => {
    expect(params(buildMapQuery("jobs", BBOX, f()))).toMatchObject({
      swLat: "44.7", swLng: "20.3", neLat: "44.9", neLng: "20.5",
    });
  });

  it("no filters → bbox only", () => {
    expect(Object.keys(params(buildMapQuery("jobs", BBOX, f())))).toEqual([
      "swLat", "swLng", "neLat", "neLng",
    ]);
  });

  it("jobs: redAlertOnly → redAlert=true", () => {
    expect(params(buildMapQuery("jobs", BBOX, f({ redAlertOnly: true })))).toMatchObject({
      redAlert: "true",
    });
  });

  it("jobs: sanitaryFree → sanitaryRequired=false", () => {
    expect(params(buildMapQuery("jobs", BBOX, f({ sanitaryFree: true })))).toMatchObject({
      sanitaryRequired: "false",
    });
  });

  it("jobs: engagementType passed through", () => {
    expect(params(buildMapQuery("jobs", BBOX, f({ engagementType: "WEEKEND" })))).toMatchObject({
      engagementType: "WEEKEND",
    });
  });

  it("venues: venueType passed through", () => {
    expect(params(buildMapQuery("venues", BBOX, f({ venueType: "BAR" })))).toMatchObject({
      venueType: "BAR",
    });
  });

  it("venues mode never sends job-only params", () => {
    // The jobs schema is strict; a stray venueType would 400 — and vice versa.
    const qs = params(
      buildMapQuery("venues", BBOX, f({ venueType: "BAR", redAlertOnly: true, engagementType: "WEEKEND" })),
    );
    expect(qs).not.toHaveProperty("redAlert");
    expect(qs).not.toHaveProperty("engagementType");
    expect(qs).toHaveProperty("venueType");
  });

  it("jobs mode never sends venue-only params", () => {
    const qs = params(buildMapQuery("jobs", BBOX, f({ venueType: "BAR", redAlertOnly: true })));
    expect(qs).not.toHaveProperty("venueType");
    expect(qs).toHaveProperty("redAlert");
  });

  it("falsy filters are omitted, never sent empty", () => {
    const qs = params(buildMapQuery("jobs", BBOX, f({ engagementType: "", redAlertOnly: false })));
    expect(qs).not.toHaveProperty("engagementType");
    expect(qs).not.toHaveProperty("redAlert");
    // An empty coord/param would be rejected by BBoxSchema — never emit one.
    expect(Object.values(qs).every((v) => v !== "")).toBe(true);
  });
});

describe("mapEndpoint", () => {
  it("maps mode to its route", () => {
    expect(mapEndpoint("jobs")).toBe("/api/jobs/geojson");
    expect(mapEndpoint("venues")).toBe("/api/venues/geojson");
  });
});

describe("isJob", () => {
  const job = { id: "j1", title: "Konobar", venue: { id: "v1" } } as unknown as JobProps;
  const venue = { id: "v1", name: "Kafana", activeJobs: 2 } as unknown as VenueProps;

  it("narrows job feature properties", () => {
    expect(isJob(job)).toBe(true);
  });

  it("rejects venue feature properties", () => {
    expect(isJob(venue)).toBe(false);
  });

  it("survives supercluster passthrough (properties copied verbatim)", () => {
    expect(isJob({ ...job })).toBe(true);
    expect(isJob({ ...venue })).toBe(false);
  });
});

describe("markerColor", () => {
  const venue = (venueType: string) => ({ id: "v", name: "X", activeJobs: 0, venueType } as unknown as VenueProps);
  const job = (engagementType: string) => ({ id: "j", title: "K", engagementType, venue: {} } as unknown as JobProps);

  it("colors a venue by its venueType", () => {
    expect(markerColor(venue("BAR"))).toBe(ENGAGEMENT_MARKER.WEEKEND); // BAR + WEEKEND share violet
    expect(markerColor(venue("HOTEL"))).toBe(VENUE_TYPE_MARKER.HOTEL);
  });

  it("colors a job by its engagementType", () => {
    expect(markerColor(job("FULL_TIME"))).toBe(ENGAGEMENT_MARKER.FULL_TIME);
    expect(markerColor(job("CELEBRATION"))).toBe(ENGAGEMENT_MARKER.CELEBRATION);
  });

  it("falls back to the brand orange for an unknown type", () => {
    expect(markerColor(venue("NOT_A_TYPE"))).toBe("#f97316");
    expect(markerColor(job("NOT_A_TYPE"))).toBe("#f97316");
  });

  it("every venue/engagement enum value has a distinct-ish hex (no undefined)", () => {
    for (const hex of Object.values(VENUE_TYPE_MARKER)) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    for (const hex of Object.values(ENGAGEMENT_MARKER)) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("legendRows", () => {
  it("venues: one row per venue type, Serbian labels", () => {
    const rows = legendRows("venues");
    expect(rows.length).toBe(Object.keys(VENUE_TYPE_MARKER).length);
    expect(rows).toContainEqual(["Restoran", VENUE_TYPE_MARKER.RESTAURANT]);
  });

  it("jobs: engagement rows plus a Red Alert row", () => {
    const rows = legendRows("jobs");
    expect(rows).toContainEqual(["Stalno", ENGAGEMENT_MARKER.FULL_TIME]);
    expect(rows.some(([label]) => label === "Red Alert")).toBe(true);
  });
});
