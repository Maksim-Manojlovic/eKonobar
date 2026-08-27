import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";

/**
 * Jobs on the map.
 *
 * The endpoint is the same one the web map uses, with the same parameters — bbox
 * plus the filter chips — so both clients get identical results for the same
 * viewport, and the Red Alert embargo is applied server-side for both.
 *
 * Filtering happens in the query, never on the response. The route caps at
 * MAX_FEATURES (300), so a client-side .filter() would filter an already
 * truncated page and quietly report "3 Red Alert" when there are forty.
 */

/** Shape confirmed against the running endpoint, not inferred from the route. */
export type JobFeature = {
  type: "Feature";
  /** GeoJSON order is [lng, lat] — the reverse of what a map region wants. */
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id:               string;
    title:            string;
    engagementType:   string;
    tipSystem:        string;
    salaryMin:        number | null;
    salaryMax:        number | null;
    sanitaryRequired: boolean;
    redAlert:         boolean;
    /** Only present for callers allowed to see it — anonymous ones get the delayed set. */
    redAlertNote:     string | null;
    startDate:        string | null;
    venue: {
      id:           string;
      name:         string;
      municipality: string | null;
      venueType:    string;
      trustScore:   number | null;
    };
  };
};

export type JobGeoJson = { type: "FeatureCollection"; features: JobFeature[] };

export type BBox = { swLat: number; swLng: number; neLat: number; neLng: number };

export type MapFilters = {
  redAlert?:         boolean;
  engagementType?:   string;
  sanitaryRequired?: boolean;
};

function buildQuery(bbox: BBox, f: MapFilters): string {
  const q = new URLSearchParams({
    swLat: String(bbox.swLat), swLng: String(bbox.swLng),
    neLat: String(bbox.neLat), neLng: String(bbox.neLng),
  });
  if (f.redAlert)                    q.set("redAlert", "true");
  if (f.engagementType)              q.set("engagementType", f.engagementType);
  if (f.sanitaryRequired !== undefined) q.set("sanitaryRequired", String(f.sanitaryRequired));
  return q.toString();
}

export function useJobsGeoJson(bbox: BBox | null, filters: MapFilters) {
  return useQuery({
    // The bbox is part of the key, so panning refetches rather than showing a
    // stale viewport's pins.
    queryKey: ["jobs", "geojson", bbox, filters],
    queryFn:  () => apiGet<JobGeoJson>(`/api/jobs/geojson?${buildQuery(bbox!, filters)}`),
    enabled:  bbox !== null,
    // Panning produces a lot of near-identical viewports; keep the previous
    // result on screen while the next one loads instead of blanking the map.
    placeholderData: prev => prev,
    staleTime: 15_000,
  });
}

/**
 * One job, in full.
 *
 * The geojson feature carries only what a pin needs — the description, tip
 * arrangement and application count are not in it, so tapping a pin fetches the
 * job itself. Shape confirmed against the running endpoint.
 *
 * Note the route is `withOptionalAuth` but is NOT in the middleware's public
 * patterns, so an anonymous caller gets 401 before the handler runs. That is
 * fine here — the app is always authenticated — but it is why this cannot be
 * reused for a public share link without adding the pattern.
 */
export type JobDetail = {
  id:                  string;
  title:               string;
  description:         string | null;
  engagementType:      string;
  salaryMin:           number | null;
  salaryMax:           number | null;
  tipSystem:           string;
  tipDescription:      string | null;
  sanitaryRequired:    boolean;
  startDate:           string | null;
  applicationDeadline: string | null;
  redAlert:            boolean;
  redAlertNote:        string | null;
  status:              string;
  createdAt:           string;
  venue: {
    id:           string;
    name:         string;
    address:      string | null;
    municipality: string | null;
    venueType:    string;
    trustScore:   number | null;
    phone:        string | null;
  };
  _count:     { applications: number };
  /** Server-computed for the signed-in waiter — never derive this client-side. */
  hasApplied: boolean;
};

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ["job", id],
    queryFn:  () => apiGet<JobDetail>(`/api/jobs/${id}`),
    enabled:  Boolean(id),
  });
}
