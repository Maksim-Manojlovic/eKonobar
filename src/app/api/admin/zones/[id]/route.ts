import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";
import { ZoneType } from "@prisma/client";
import { refreshAllVenueZoneCaches } from "@/lib/analytics";

// PATCH — update zone fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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

  refreshAllVenueZoneCaches().catch(console.error);

  return NextResponse.json(updated);
}

// DELETE — remove zone (also clears VenueZoneRelation via cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const zone = await dbRaw.venueZone.findUnique({ where: { id }, select: { id: true } });
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  // Clear relations first (no cascade defined on VenueZoneRelation → VenueZone)
  await dbRaw.$transaction([
    dbRaw.venueZoneRelation.deleteMany({ where: { zoneId: id } }),
    dbRaw.venueZone.delete({ where: { id } }),
  ]);

  refreshAllVenueZoneCaches().catch(console.error);

  return NextResponse.json({ deleted: true, id });
}
