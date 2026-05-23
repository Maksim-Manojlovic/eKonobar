import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/analytics";

// GET — list all zones (public for map, admin sees inactive too)
export const GET = withOptionalAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url);
  const isAdmin = session?.user.role === "ADMIN";

  const zones = await dbRaw.venueZone.findMany({
    where: isAdmin ? undefined : { isActive: true },
    orderBy: { createdAt: "desc" },
    ...(searchParams.get("type") && {
      where: {
        ...(isAdmin ? {} : { isActive: true }),
        zoneType: searchParams.get("type") as ZoneType,
      },
    }),
  });

  return NextResponse.json(zones);
});

// POST — admin creates new zone
export const POST = withRole("ADMIN", async (req) => {
  const body = await req.json();
  const {
    name, zoneType, description, geoJson,
    centerLat, centerLng, radiusKm,
    projectedGrowthPercent, operatorTip,
  } = body;

  if (!name || !zoneType || !geoJson || centerLat == null || centerLng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(ZoneType).includes(zoneType)) {
    return NextResponse.json({ error: "Invalid zoneType" }, { status: 400 });
  }

  const zone = await dbRaw.venueZone.create({
    data: {
      name,
      zoneType,
      description: description ?? null,
      geoJson,
      centerLat: Number(centerLat),
      centerLng: Number(centerLng),
      radiusKm: radiusKm ? Number(radiusKm) : 1.0,
      projectedGrowthPercent: projectedGrowthPercent ? Number(projectedGrowthPercent) : 0,
      operatorTip: operatorTip ?? null,
    },
  });

  refreshAllVenueZoneCaches().catch(console.error);

  return NextResponse.json(zone, { status: 201 });
});
