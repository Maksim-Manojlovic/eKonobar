import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { EngagementType } from "@prisma/client";

function stableJitter(id: string): { lat: number; lng: number } {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 33) + id.charCodeAt(i)) | 0;
  const u = h >>> 0;
  return {
    lat: ((u % 200) - 100) / 111_000,
    lng: (((u >>> 8) % 200) - 100) / 78_700,
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

  const redAlert       = searchParams.get("redAlert") === "true" ? true : undefined;
  const engagementType = searchParams.get("engagementType") as EngagementType | null;
  const sanitaryRaw    = searchParams.get("sanitaryRequired");
  const sanitaryRequired =
    sanitaryRaw === "true" ? true : sanitaryRaw === "false" ? false : undefined;

  const jobs = await db.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(redAlert !== undefined && { redAlert }),
      ...(engagementType &&
        Object.values(EngagementType).includes(engagementType) && { engagementType }),
      ...(sanitaryRequired !== undefined && { sanitaryRequired }),
      venue: {
        isActive: true,
        latitude:  { gte: swLat, lte: neLat },
        longitude: { gte: swLng, lte: neLng },
      },
    },
    select: {
      id: true,
      title: true,
      engagementType: true,
      tipSystem: true,
      salaryMin: true,
      salaryMax: true,
      sanitaryRequired: true,
      redAlert: true,
      redAlertNote: true,
      startDate: true,
      venue: {
        select: {
          id: true,
          name: true,
          municipality: true,
          venueType: true,
          latitude: true,
          longitude: true,
          trustScore: true,
        },
      },
    },
    orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const features = jobs.map((j) => {
    const jitter = stableJitter(j.venue.id);
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [j.venue.longitude + jitter.lng, j.venue.latitude + jitter.lat],
      },
      properties: {
        id: j.id,
        title: j.title,
        engagementType: j.engagementType,
        tipSystem: j.tipSystem,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        sanitaryRequired: j.sanitaryRequired,
        redAlert: j.redAlert,
        redAlertNote: j.redAlertNote,
        startDate: j.startDate,
        venue: {
          id: j.venue.id,
          name: j.venue.name,
          municipality: j.venue.municipality,
          venueType: j.venue.venueType,
          trustScore: j.venue.trustScore,
        },
      },
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}
