import { DEFAULT_CITY } from "@/lib/geo/cities";
import type { JobProps, MapFilters, MapMode, MapProps } from "./map-types";

/** Initial viewport. Belgrade until a city picker exists — see lib/geo/cities.ts. */
export const INITIAL_VIEW = {
  longitude: DEFAULT_CITY.center.longitude,
  latitude:  DEFAULT_CITY.center.latitude,
  zoom:      DEFAULT_CITY.zoom,
};

export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/** radius 60px matches the marker footprint; maxZoom 17 stops clustering before street level. */
export const CLUSTER_OPTIONS = { radius: 60, maxZoom: 17 };

export const EMPTY_FILTERS: MapFilters = {
  engagementType: "",
  redAlertOnly:   false,
  sanitaryFree:   false,
  venueType:      "",
};

/**
 * Narrows map feature properties without threading `mode` down to every leaf.
 * `title` exists on job features only, and survives supercluster (which copies
 * `properties` through untouched).
 */
export function isJob(p: MapProps): p is JobProps {
  return "title" in p;
}

/** Stable id for any feature — job posts and venues never share an id space. */
export function featureId(p: MapProps): string {
  return p.id;
}

/**
 * Query string for the mode's geojson endpoint.
 *
 * Pure and exported for unit testing. Only sends the keys the mode's route
 * accepts — sending `venueType` to /api/jobs/geojson would 400 (its schema is
 * strict), and sending a filter the user did not set would narrow the result.
 */
export function buildMapQuery(mode: MapMode, bbox: {
  swLat: number; swLng: number; neLat: number; neLng: number;
}, filters: MapFilters): string {
  const p = new URLSearchParams({
    swLat: String(bbox.swLat),
    swLng: String(bbox.swLng),
    neLat: String(bbox.neLat),
    neLng: String(bbox.neLng),
  });

  if (mode === "jobs") {
    if (filters.redAlertOnly)   p.set("redAlert", "true");
    if (filters.sanitaryFree)   p.set("sanitaryRequired", "false");
    if (filters.engagementType) p.set("engagementType", filters.engagementType);
  } else if (filters.venueType) {
    p.set("venueType", filters.venueType);
  }

  return p.toString();
}

export function mapEndpoint(mode: MapMode): string {
  return mode === "jobs" ? "/api/jobs/geojson" : "/api/venues/geojson";
}

/** Serbian empty-state copy per mode. */
export const EMPTY_STATE: Record<MapMode, { icon: string; text: string }> = {
  jobs:   { icon: "🔍", text: "Nema oglasa u ovom području." },
  venues: { icon: "🍽️", text: "Nema lokala u ovom području." },
};
