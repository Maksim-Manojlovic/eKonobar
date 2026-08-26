import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/geo/analytics";
import logger from "@/lib/core/logger";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ZoneCreateSchema = z.object({
  name:                   z.string().min(1),
  zoneType:               z.nativeEnum(ZoneType),
  geoJson:                z.record(z.unknown()),
  centerLat:              z.number(),
  centerLng:              z.number(),
  radiusKm:               z.number().optional(),
  projectedGrowthPercent: z.number().optional(),
  operatorTip:            z.string().nullish(),
  description:            z.string().nullish(),
  isActive:               z.boolean().optional(),
});

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
  const parsed = await parseBody(ZoneCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, zoneType, geoJson, centerLat, centerLng, radiusKm, projectedGrowthPercent, operatorTip, description } = parsed.data;

  const zone = await dbRaw.venueZone.create({
    data: {
      name,
      zoneType,
      description: description ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geoJson: geoJson as any,
      centerLat,
      centerLng,
      radiusKm: radiusKm ?? 1.0,
      projectedGrowthPercent: projectedGrowthPercent ?? 0,
      operatorTip: operatorTip ?? null,
    },
  });

  refreshAllVenueZoneCaches().catch(err => logger.error({ err }, "refreshAllVenueZoneCaches failed after zone create"));

  return NextResponse.json(zone, { status: 201 });
});
