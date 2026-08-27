/**
 * Zone-insight shapes.
 *
 * Split out of apps/web's lib/geo/analytics.ts because Venue.venueInsights is
 * part of the venue API response, and api/venue.ts must not reach into a web
 * module to describe it — that import made the shared package unresolvable from
 * the mobile app, which has no `@/` alias pointing at apps/web/src.
 *
 * Types only. The computation stays in apps/web: it queries the database.
 */

export interface ZoneInsightItem {
  zoneId: string;
  name: string;
  type: string;
  distanceKm: number;
  projectedGrowthPercent: number;
  operatorTip: string | null;
}

export interface VenueZoneInsights {
  insights: ZoneInsightItem[];
  totalProjectedGrowth: number;
  hasZoneBadge: boolean;
  cachedAt: string;
}
