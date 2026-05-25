import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

export const GET = withRole("WAITER", async (_req, _ctx, session) => {
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
});
