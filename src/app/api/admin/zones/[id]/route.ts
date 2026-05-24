import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/analytics";
import logger from "@/lib/logger";

// PATCH — update zone fields
export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();

  const zone = await dbRaw.venueZone.findUnique({ where: { id } });
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  if (body.zoneType && !Object.values(ZoneType).includes(body.zoneType)) {
    return NextResponse.json({ error: "Invalid zoneType" }, { status: 400 });
  }

  const updated = await dbRaw.venueZone.update({
    where: { id },
    data: {
      ...(body.name               !== undefined && { name: body.name }),
      ...(body.zoneType           !== undefined && { zoneType: body.zoneType }),
      ...(body.description        !== undefined && { description: body.description }),
      ...(body.geoJson            !== undefined && { geoJson: body.geoJson }),
      ...(body.centerLat          !== undefined && { centerLat: Number(body.centerLat) }),
      ...(body.centerLng          !== undefined && { centerLng: Number(body.centerLng) }),
      ...(body.radiusKm           !== undefined && { radiusKm: Number(body.radiusKm) }),
      ...(body.projectedGrowthPercent !== undefined && { projectedGrowthPercent: Number(body.projectedGrowthPercent) }),
      ...(body.operatorTip        !== undefined && { operatorTip: body.operatorTip }),
      ...(body.isActive           !== undefined && { isActive: Boolean(body.isActive) }),
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
