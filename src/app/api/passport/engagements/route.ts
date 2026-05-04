import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const engagements = await db.engagementRecord.findMany({
    where: { waiterId: session.user.id },
    include: {
      venue: { select: { id: true, name: true, venueType: true } },
    },
    orderBy: { startDate: "desc" },
  });

  const mapped = engagements.map(e => ({
    id: e.id,
    venueId: e.venueId,
    venueName: e.venue.name,
    venueType: e.venue.venueType,
    notes: e.notes ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    verified: e.verified,
    engagementType: e.engagementType,
  }));

  return NextResponse.json(mapped);
}
