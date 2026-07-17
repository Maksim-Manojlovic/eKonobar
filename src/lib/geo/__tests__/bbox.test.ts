import { describe, it, expect } from "vitest";
import { BBoxSchema, venueBBoxFilter, stableJitter } from "../bbox";

const VALID = { swLat: "44.7", swLng: "20.3", neLat: "44.9", neLng: "20.5" };

describe("BBoxSchema", () => {
  it("coerces numeric strings from query params", () => {
    const parsed = BBoxSchema.parse(VALID);
    expect(parsed).toEqual({ swLat: 44.7, swLng: 20.3, neLat: 44.9, neLng: 20.5 });
  });

  it.each(["swLat", "swLng", "neLat", "neLng"])("missing %s → invalid", (key) => {
    const input = { ...VALID } as Record<string, string>;
    delete input[key];
    expect(BBoxSchema.safeParse(input).success).toBe(false);
  });

  it("non-numeric value → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLat: "abc" }).success).toBe(false);
  });

  it("empty string → invalid (not coerced to 0)", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLat: "" }).success).toBe(false);
  });

  it("whitespace-only → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLng: "   " }).success).toBe(false);
  });

  it("an empty param never widens the viewport to the equator", () => {
    // Regression: z.coerce.number() maps "" → 0, which passes the sw<ne refine
    // against a real neLat and silently returns everything from lat 0 northward.
    const parsed = BBoxSchema.safeParse({ ...VALID, swLat: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("swLat");
    }
  });

  it("latitude beyond ±90 → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLat: "-91" }).success).toBe(false);
    expect(BBoxSchema.safeParse({ ...VALID, neLat: "91" }).success).toBe(false);
  });

  it("longitude beyond ±180 → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLng: "-181" }).success).toBe(false);
    expect(BBoxSchema.safeParse({ ...VALID, neLng: "181" }).success).toBe(false);
  });

  it("inverted latitudes → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLat: "44.9", neLat: "44.7" }).success).toBe(false);
  });

  it("inverted longitudes → invalid", () => {
    expect(BBoxSchema.safeParse({ ...VALID, swLng: "20.5", neLng: "20.3" }).success).toBe(false);
  });

  it("degenerate box (sw === ne) → invalid", () => {
    expect(
      BBoxSchema.safeParse({ swLat: "44.8", swLng: "20.4", neLat: "44.8", neLng: "20.4" }).success,
    ).toBe(false);
  });

  it("accepts a viewport outside Belgrade (coverage follows the data)", () => {
    // Novi Sad — must parse today so adding a city needs no endpoint change.
    expect(
      BBoxSchema.safeParse({ swLat: "45.2", swLng: "19.7", neLat: "45.3", neLng: "19.9" }).success,
    ).toBe(true);
  });
});

describe("venueBBoxFilter", () => {
  it("maps a bbox onto Prisma lat/lng range filters", () => {
    expect(venueBBoxFilter({ swLat: 44.7, swLng: 20.3, neLat: 44.9, neLng: 20.5 })).toEqual({
      latitude:  { gte: 44.7, lte: 44.9 },
      longitude: { gte: 20.3, lte: 20.5 },
    });
  });
});

describe("stableJitter", () => {
  it("is deterministic — a venue never appears to move between requests", () => {
    expect(stableJitter("venue-abc")).toEqual(stableJitter("venue-abc"));
  });

  it("differs across ids", () => {
    expect(stableJitter("venue-abc")).not.toEqual(stableJitter("venue-xyz"));
  });

  it("stays within ~100m in each axis", () => {
    for (const id of ["a", "venue-1", "clx8k2j0000001", "ЋИРИЛИЦА"]) {
      const { lat, lng } = stableJitter(id);
      expect(Math.abs(lat)).toBeLessThanOrEqual(100 / 111_000);
      expect(Math.abs(lng)).toBeLessThanOrEqual(100 / 78_700);
    }
  });

  it("handles the empty string without NaN", () => {
    const { lat, lng } = stableJitter("");
    expect(Number.isNaN(lat)).toBe(false);
    expect(Number.isNaN(lng)).toBe(false);
  });
});
