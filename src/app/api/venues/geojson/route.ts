import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Deterministic ~100m coordinate jitter for privacy (stable per venueId).
function stableJitter(id: string): { lat: number; lng: number } {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 33) + id.charCodeAt(i)) | 0;
  const u = h >>> 0;
  return {
    lat: ((u % 200) - 100) / 111_000,           // ±~100m in latitude
    lng: (((u >>> 8) % 200) - 100) / 78_700,    // ±~100m in longitude (at ~45°N)
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const swLat = parseFloat(searchParams.get("swLat") ?? "");
  const swLng = parseFloat(searchParams.get("swLng") ?? "");
  const neLat = parseFloat(searchParams.get("neLat") ?? "");
  const neLng = parseFloat(searchParams.get("neLng") ?? "");

  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json(
      { error: "swLat, swLng, neLat, neLng required" },
      { status: 400 },
    );
  }

  const venues = await db.venue.findMany({
    where: {
      isActive: true,
      latitude:  { gte: swLat, lte: neLat },
      longitude: { gte: swLng, lte: neLng },
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
      _count: { select: { jobPosts: true } },
      zones: {
        select: { zone: { select: { zoneType: true, projectedGrowthPercent: true } } },
        take: 1,
      },
    },
    take: 200,
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
