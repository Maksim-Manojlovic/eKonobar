import { dbRaw } from "@/lib/core/db";
import { haversineKm } from "@/lib/geo/geofence";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Zone tipovi koji nose projectedGrowthPercent i prikazuju badge na lokalu.
const INVESTMENT_ZONE_TYPES = new Set([
  "FESTIVAL_ZONE",
  "TRANSIT_HUB",
  "DEVELOPMENT",
]);

// ─── Single venue cache ───────────────────────────────────────────────────────

export async function getVenueZoneInsights(
  lat: number,
  lon: number,
): Promise<VenueZoneInsights> {
  const zones = await dbRaw.venueZone.findMany({ where: { isActive: true } });

  const insights: ZoneInsightItem[] = [];
  for (const z of zones) {
    const dist = haversineKm(lat, lon, z.centerLat, z.centerLng);
    if (dist <= z.radiusKm) {
      insights.push({
        zoneId: z.id,
        name: z.name,
        type: z.zoneType,
        distanceKm: Math.round(dist * 10) / 10,
        projectedGrowthPercent: z.projectedGrowthPercent,
        operatorTip: z.operatorTip,
      });
    }
  }

  insights.sort((a, b) => a.distanceKm - b.distanceKm);

  const investmentInsights = insights.filter((i) =>
    INVESTMENT_ZONE_TYPES.has(i.type),
  );
  const totalProjectedGrowth =
    Math.round(
      investmentInsights.reduce((sum, i) => sum + i.projectedGrowthPercent, 0) * 10,
    ) / 10;

  return {
    insights,
    totalProjectedGrowth,
    hasZoneBadge: investmentInsights.length > 0,
    cachedAt: new Date().toISOString(),
  };
}

// ─── Per-venue cache refresh ──────────────────────────────────────────────────

export async function refreshVenueZoneCache(venueId: string): Promise<void> {
  const venue = await dbRaw.venue.findUnique({
    where: { id: venueId },
    select: { latitude: true, longitude: true },
  });

  if (!venue?.latitude || !venue?.longitude) {
    await dbRaw.venue.update({
      where: { id: venueId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { venueInsights: null as any },
    });
    return;
  }

  const insights = await getVenueZoneInsights(venue.latitude, venue.longitude);
  await dbRaw.venue.update({
    where: { id: venueId },
    data: { venueInsights: insights as object },
  });
}

// ─── Full cache rebuild ───────────────────────────────────────────────────────

export async function refreshAllVenueZoneCaches(): Promise<void> {
  const [venues, zones] = await Promise.all([
    dbRaw.venue.findMany({
      where: { deletedAt: null },
      select: { id: true, latitude: true, longitude: true },
    }),
    dbRaw.venueZone.findMany({ where: { isActive: true } }),
  ]);

  for (const venue of venues) {

    const insights: ZoneInsightItem[] = [];

    for (const z of zones) {
      const dist = haversineKm(venue.latitude, venue.longitude, z.centerLat, z.centerLng);
      if (dist <= z.radiusKm) {
        insights.push({
          zoneId: z.id,
          name: z.name,
          type: z.zoneType,
          distanceKm: Math.round(dist * 10) / 10,
          projectedGrowthPercent: z.projectedGrowthPercent,
          operatorTip: z.operatorTip,
        });
      }
    }

    insights.sort((a, b) => a.distanceKm - b.distanceKm);

    const investmentInsights = insights.filter((i) =>
      INVESTMENT_ZONE_TYPES.has(i.type),
    );
    const totalProjectedGrowth =
      Math.round(
        investmentInsights.reduce((sum, i) => sum + i.projectedGrowthPercent, 0) * 10,
      ) / 10;

    const result: VenueZoneInsights = {
      insights,
      totalProjectedGrowth,
      hasZoneBadge: investmentInsights.length > 0,
      cachedAt: new Date().toISOString(),
    };

    await dbRaw.venue.update({
      where: { id: venue.id },
      data: { venueInsights: result as object },
    });
  }
}
