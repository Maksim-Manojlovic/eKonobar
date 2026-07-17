/**
 * Map feature + filter types. Declarations only — runtime constants live in
 * `map-constants.ts`.
 */

export type MapMode = "jobs" | "venues";

export interface JobProps {
  id:               string;
  title:            string;
  engagementType:   string;
  tipSystem:        string | null;
  salaryMin:        number | null;
  salaryMax:        number | null;
  sanitaryRequired: boolean;
  redAlert:         boolean;
  redAlertNote:     string | null;
  startDate:        string | null;
  venue: {
    id:           string;
    name:         string;
    municipality: string | null;
    venueType:    string | null;
    trustScore:   number | null;
  };
}

export interface VenueProps {
  id:            string;
  name:          string;
  venueType:     string | null;
  municipality:  string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  trustScore:    number | null;
  activeJobs:    number;
  zone: { zoneType: string; projectedGrowthPercent: number } | null;
}

/**
 * Properties of any map feature.
 *
 * Narrow with `isJob()` from `map-constants.ts` rather than threading `mode`
 * through every leaf: `title` is present on job features and absent on venue
 * features, so it survives supercluster (which preserves `properties` verbatim).
 */
export type MapProps = JobProps | VenueProps;

export interface GeoFeature<P> {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
}

export type MapFeature = GeoFeature<MapProps>;

export interface BBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

/** `[west, south, east, north]` — the tuple supercluster expects. */
export type ClusterBounds = [number, number, number, number];

/**
 * All map filter state in one object (never one `useState` per field — see
 * "Grouped form state" in CLAUDE.md). Jobs and venues share the bag; each mode
 * reads only its own keys and `buildMapQuery` sends only those.
 */
export interface MapFilters {
  engagementType: string;
  redAlertOnly:   boolean;
  sanitaryFree:   boolean;
  venueType:      string;
}

export interface PopupState {
  lng:   number;
  lat:   number;
  props: MapProps;
}
