import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/geo/analytics";
import logger from "@/lib/core/logger";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ZonePatchSchema = z.object({
  name:                   z.string().min(1).optional(),
  zoneType:               z.nativeEnum(ZoneType).optional(),
  description:            z.string().nullish(),
  geoJson:                z.record(z.unknown()).optional(),
  centerLat:              z.number().optional(),
  centerLng:              z.number().optional(),
  radiusKm:               z.number().optional(),
  projectedGrowthPercent: z.number().optional(),
  operatorTip:            z.string().nullish(),
  isActive:               z.boolean().optional(),
});

// PATCH — update zone fields
export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(ZonePatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const zone = await dbRaw.venueZone.findUnique({ where: { id } });
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  const updated = await dbRaw.venueZone.update({
    where: { id },
    data: {
      ...(body.name               !== undefined && { name: body.name }),
      ...(body.zoneType           !== undefined && { zoneType: body.zoneType }),
      ...(body.description        !== undefined && { description: body.description }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.geoJson            !== undefined && { geoJson: body.geoJson as any }),
      ...(body.centerLat          !== undefined && { centerLat: body.centerLat }),
      ...(body.centerLng          !== undefined && { centerLng: body.centerLng }),
      ...(body.radiusKm           !== undefined && { radiusKm: body.radiusKm }),
      ...(body.projectedGrowthPercent !== undefined && { projectedGrowthPercent: body.projectedGrowthPercent }),
      ...(body.operatorTip        !== undefined && { operatorTip: body.operatorTip }),
      ...(body.isActive           !== undefined && { isActive: body.isActive }),
    },
  });

  refreshAllVenueZoneCaches().catch(err => logger.error({ err, zoneId: id }, "refreshAllVenueZoneCaches failed after zone update"));

  return NextResponse.json(updated);
});

// DELETE — remove zone (also clears VenueZoneRelation via cascade)
export const DELETE = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (_req, ctx) => {
  const { id } = await ctx.params;

  const zone = await dbRaw.venueZone.findUnique({ where: { id }, select: { id: true } });
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  // Clear relations first (no cascade defined on VenueZoneRelation → VenueZone)
  await dbRaw.$transaction([
    dbRaw.venueZoneRelation.deleteMany({ where: { zoneId: id } }),
    dbRaw.venueZone.delete({ where: { id } }),
  ]);

  refreshAllVenueZoneCaches().catch(err => logger.error({ err, zoneId: id }, "refreshAllVenueZoneCaches failed after zone delete"));

  return NextResponse.json({ deleted: true, id });
});
