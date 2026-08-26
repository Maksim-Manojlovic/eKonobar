import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeofenceTarget {
  latitude: number;
  longitude: number;
  reviewRadiusKm: number;
}

export interface GeofenceResult {
  allowed: boolean;
  distanceKm: number;
  radiusKm: number;
}

// ─── Haversine ────────────────────────────────────────────────────────────────

/**
 * Haversine formula — identična implementacija kao u analytics.ts.
 * Odvojena ovde da geofence.ts ne zahteva db import.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geofence provjera ────────────────────────────────────────────────────────

/**
 * Proverava da li su gostove koordinate unutar dozvoljenog radijusa lokala.
 *
 * Koristi se u POST /api/reviews za GUEST_TO_WAITER recenzije.
 * Lokali definišu reviewRadiusKm (default 0.15km = 150m).
 *
 * @example
 * const result = isInsideVenueRadius(
 *   { lat: guestLat, lon: guestLon },
 *   venue
 * );
 * if (!result.allowed) {
 *   return NextResponse.json({ error: "Morate biti u lokalu..." }, { status: 403 });
 * }
 */
export function isInsideVenueRadius(
  guest: { lat: number; lon: number },
  venue: GeofenceTarget,
): GeofenceResult {
  const distanceKm = haversineKm(
    guest.lat,
    guest.lon,
    venue.latitude,
    venue.longitude,
  );

  return {
    allowed: distanceKm <= venue.reviewRadiusKm,
    distanceKm: Math.round(distanceKm * 1000) / 1000, // 3 decimale
    radiusKm: venue.reviewRadiusKm,
  };
}

// ─── Proof of location ────────────────────────────────────────────────────────

/**
 * Kreira SHA-256 hash koordinata + timestamp kao dokaz lokacije.
 * Čuvamo kao geolocationHash na Review modelu za eventualne sporove.
 *
 * Format: SHA-256("lat:lon:unixTimestampSeconds")
 */
export function createGeolocationHash(
  lat: number,
  lon: number,
  timestampMs = Date.now(),
): string {
  const timestampSec = Math.floor(timestampMs / 1000);
  const payload = `${lat.toFixed(6)}:${lon.toFixed(6)}:${timestampSec}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── Validacija koordinata iz request body ────────────────────────────────────

/**
 * Type guard za validaciju koordinata iz POST body-a.
 * Koristi se u reviews/route.ts pre geofence provere.
 */
export function parseGuestCoordinates(
  lat: unknown,
  lon: unknown,
): { lat: number; lon: number } | null {
  const parsedLat = typeof lat === "number" ? lat : parseFloat(String(lat));
  const parsedLon = typeof lon === "number" ? lon : parseFloat(String(lon));

  if (isNaN(parsedLat) || isNaN(parsedLon)) return null;
  if (parsedLat < -90 || parsedLat > 90) return null;
  if (parsedLon < -180 || parsedLon > 180) return null;

  return { lat: parsedLat, lon: parsedLon };
}
