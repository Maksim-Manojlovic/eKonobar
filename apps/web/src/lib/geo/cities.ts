/**
 * Seeded cities.
 *
 * Belgrade is the only one today. The map's initial viewport reads from here so
 * that adding Novi Sad or Niš is one entry plus a city picker — not a grep for
 * hardcoded coordinates. The `/geojson` endpoints are already city-agnostic
 * (they filter by viewport bbox, not by city), so nothing server-side changes.
 */
export interface City {
  id:     string;
  label:  string;
  center: { longitude: number; latitude: number };
  zoom:   number;
}

export const CITIES = {
  BEOGRAD: {
    id:     "BEOGRAD",
    label:  "Beograd",
    center: { longitude: 20.4633, latitude: 44.8176 },
    zoom:   12,
  },
} as const satisfies Record<string, City>;

export type CityId = keyof typeof CITIES;

/** Initial map viewport until a city picker exists. */
export const DEFAULT_CITY: City = CITIES.BEOGRAD;
