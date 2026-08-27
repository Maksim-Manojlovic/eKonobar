import { z } from "zod";

/**
 * Map viewport bounding box — shared by every `/geojson` map endpoint.
 *
 * Coordinates are deliberately unclamped: map coverage follows the data, so
 * panning to Novi Sad works the day the first venue there exists. Belgrade is
 * the only seeded city today (see `lib/geo/cities.ts` for the initial viewport),
 * and nothing here needs to change to add another.
 *
 * Not antimeridian-safe — `swLng < neLng` cannot express a box straddling ±180°.
 * Serbia is nowhere near it; revisit only if coverage ever leaves Europe.
 */
/**
 * A required coordinate query param.
 *
 * Guards the empty string before coercion: `z.coerce.number()` alone turns `""`
 * into `0`, so `?swLat=&neLat=44.9` would silently widen the viewport to the
 * equator instead of failing. Reject it as the missing value it is.
 */
const coord = (min: number, max: number) =>
  z.string().trim().min(1).pipe(z.coerce.number().min(min).max(max));

export const BBoxSchema = z
  .object({
    swLat: coord(-90, 90),
    swLng: coord(-180, 180),
    neLat: coord(-90, 90),
    neLng: coord(-180, 180),
  })
  .refine((b) => b.swLat < b.neLat, {
    message: "swLat must be south of neLat",
    path: ["swLat"],
  })
  .refine((b) => b.swLng < b.neLng, {
    message: "swLng must be west of neLng",
    path: ["swLng"],
  });

export type BBox = z.infer<typeof BBoxSchema>;

/** Prisma lat/lng range filter for a venue inside `bbox`. */
export function venueBBoxFilter(bbox: BBox) {
  return {
    latitude:  { gte: bbox.swLat, lte: bbox.neLat },
    longitude: { gte: bbox.swLng, lte: bbox.neLng },
  };
}

/**
 * Deterministic ~100m coordinate jitter, stable per id.
 *
 * Privacy: published venue coordinates mark the zone, never the exact address.
 * Stable per id so a venue does not appear to jump between requests.
 */
export function stableJitter(id: string): { lat: number; lng: number } {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 33) + id.charCodeAt(i)) | 0;
  const u = h >>> 0;
  return {
    lat: ((u % 200) - 100) / 111_000,           // ±~100m in latitude
    lng: (((u >>> 8) % 200) - 100) / 78_700,    // ±~100m in longitude (at ~45°N)
  };
}
