import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/analytics";

// GET — list all zones (public for map, admin sees inactive too)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
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
}

// POST — admin creates new zone
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
