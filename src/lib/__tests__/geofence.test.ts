import { describe, it, expect } from "vitest";
import {
  haversineKm,
  isInsideVenueRadius,
  createGeolocationHash,
  parseGuestCoordinates,
  type GeofenceTarget,
} from "../geofence";

// ── haversineKm ───────────────────────────────────────────────────────────────

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(44.8, 20.4, 44.8, 20.4)).toBe(0);
  });

  it("calculates known distance: Belgrade center to Novi Sad ~70km", () => {
    // Belgrade: 44.8176, 20.4569 — Novi Sad: 45.2671, 19.8335
    const km = haversineKm(44.8176, 20.4569, 45.2671, 19.8335);
    expect(km).toBeGreaterThan(65);
    expect(km).toBeLessThan(75);
  });

  it("is symmetric", () => {
    const a = haversineKm(44.8, 20.4, 45.2, 19.8);
    const b = haversineKm(45.2, 19.8, 44.8, 20.4);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it("100m offset produces ~0.1km distance", () => {
    // 0.001 degree latitude ≈ 111m
    const km = haversineKm(44.8, 20.4, 44.801, 20.4);
    expect(km).toBeGreaterThan(0.08);
    expect(km).toBeLessThan(0.15);
  });
});

// ── isInsideVenueRadius ───────────────────────────────────────────────────────

describe("isInsideVenueRadius", () => {
  const venue: GeofenceTarget = {
    latitude: 44.8176,
    longitude: 20.4569,
    reviewRadiusKm: 0.15, // 150m
  };

  it("allows guest at venue location", () => {
    const result = isInsideVenueRadius({ lat: 44.8176, lon: 20.4569 }, venue);
    expect(result.allowed).toBe(true);
    expect(result.distanceKm).toBe(0);
  });

  it("allows guest within radius", () => {
    // ~50m away (0.0005 degrees ≈ 55m at this latitude)
    const result = isInsideVenueRadius({ lat: 44.8181, lon: 20.4569 }, venue);
    expect(result.allowed).toBe(true);
    expect(result.distanceKm).toBeLessThan(0.15);
  });

  it("rejects guest outside radius", () => {
    // ~500m away
    const result = isInsideVenueRadius({ lat: 44.822, lon: 20.4569 }, venue);
    expect(result.allowed).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(0.15);
  });

  it("returns correct radiusKm in result", () => {
    const result = isInsideVenueRadius({ lat: 44.8176, lon: 20.4569 }, venue);
    expect(result.radiusKm).toBe(0.15);
  });

  it("distance is rounded to 3 decimal places", () => {
    const result = isInsideVenueRadius({ lat: 44.8181, lon: 20.4569 }, venue);
    const decimals = result.distanceKm.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(3);
  });

  it("works with 1km radius venue", () => {
    const largeVenue: GeofenceTarget = { ...venue, reviewRadiusKm: 1.0 };
    // ~500m away
    const result = isInsideVenueRadius({ lat: 44.822, lon: 20.4569 }, largeVenue);
    expect(result.allowed).toBe(true);
  });
});

// ── createGeolocationHash ─────────────────────────────────────────────────────

describe("createGeolocationHash", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for same inputs", () => {
    const h1 = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    const h2 = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    expect(h1).toBe(h2);
  });

  it("differs for different coordinates", () => {
    const h1 = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    const h2 = createGeolocationHash(44.8177, 20.4569, 1000000000000);
    expect(h1).not.toBe(h2);
  });

  it("differs for different timestamps", () => {
    const h1 = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    const h2 = createGeolocationHash(44.8176, 20.4569, 1000000001000);
    expect(h1).not.toBe(h2);
  });

  it("same-second timestamps produce same hash", () => {
    // timestampMs floored to seconds, so 0-999ms difference = same hash
    const h1 = createGeolocationHash(44.8176, 20.4569, 1000000000000);
    const h2 = createGeolocationHash(44.8176, 20.4569, 1000000000999);
    expect(h1).toBe(h2);
  });
});

// ── parseGuestCoordinates ─────────────────────────────────────────────────────

describe("parseGuestCoordinates", () => {
  it("parses valid number inputs", () => {
    const result = parseGuestCoordinates(44.8176, 20.4569);
    expect(result).toEqual({ lat: 44.8176, lon: 20.4569 });
  });

  it("parses valid string inputs", () => {
    const result = parseGuestCoordinates("44.8176", "20.4569");
    expect(result).toEqual({ lat: 44.8176, lon: 20.4569 });
  });

  it("returns null for NaN", () => {
    expect(parseGuestCoordinates("abc", 20.4)).toBeNull();
    expect(parseGuestCoordinates(44.8, "xyz")).toBeNull();
    expect(parseGuestCoordinates(NaN, NaN)).toBeNull();
  });

  it("returns null for out-of-range latitude", () => {
    expect(parseGuestCoordinates(91, 20.4)).toBeNull();
    expect(parseGuestCoordinates(-91, 20.4)).toBeNull();
  });

  it("returns null for out-of-range longitude", () => {
    expect(parseGuestCoordinates(44.8, 181)).toBeNull();
    expect(parseGuestCoordinates(44.8, -181)).toBeNull();
  });

  it("accepts boundary values", () => {
    expect(parseGuestCoordinates(90, 180)).toEqual({ lat: 90, lon: 180 });
    expect(parseGuestCoordinates(-90, -180)).toEqual({ lat: -90, lon: -180 });
    expect(parseGuestCoordinates(0, 0)).toEqual({ lat: 0, lon: 0 });
  });

  it("returns null for null/undefined inputs", () => {
    expect(parseGuestCoordinates(null, 20.4)).toBeNull();
    expect(parseGuestCoordinates(44.8, undefined)).toBeNull();
  });
});
