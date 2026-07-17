import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { parseQuery } from "@/lib/auth/parse-body";
import { BBoxSchema, venueBBoxFilter, stableJitter } from "@/lib/geo/bbox";
import { VenueType } from "@prisma/client";
import { z } from "zod";

/**
 * Cap on features returned per viewport. Filters are applied in the query (never
 * client-side) so this truncates the *filtered* set — filtering after a truncated
 * fetch silently drops matches and makes the UI lie about how many exist.
 */
const MAX_FEATURES = 200;

const QuerySchema = BBoxSchema.and(
  z.object({
    venueType: z.nativeEnum(VenueType).optional(),
  }),
);

export async function GET(req: NextRequest) {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueType, ...bbox } = parsed.data;

  const venues = await db.venue.findMany({
    where: {
      isActive: true,
      ...venueBBoxFilter(bbox),
      ...(venueType && { venueType }),
    },
    select: {
      id: true,
      name: true,
      venueType: true,
      municipality: true,
      priceRangeMin: true,
      priceRangeMax: true,
      trustScore: true,
      latitude: true,
      longitude: true,
      // Counts ACTIVE posts only — the popup renders this as "aktivnih oglasa",
      // so an unfiltered count would advertise closed and draft posts as open.
      _count: { select: { jobPosts: { where: { status: "ACTIVE" } } } },
      zones: {
        select: { zone: { select: { zoneType: true, projectedGrowthPercent: true } } },
        take: 1,
      },
    },
    take: MAX_FEATURES,
  });

  const features = venues.map((v) => {
    const jitter = stableJitter(v.id);
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [v.longitude + jitter.lng, v.latitude + jitter.lat],
      },
      properties: {
        id: v.id,
        name: v.name,
        venueType: v.venueType,
        municipality: v.municipality,
        priceRangeMin: v.priceRangeMin,
        priceRangeMax: v.priceRangeMax,
        trustScore: v.trustScore,
        activeJobs: v._count.jobPosts,
        zone: v.zones[0]?.zone ?? null,
      },
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
