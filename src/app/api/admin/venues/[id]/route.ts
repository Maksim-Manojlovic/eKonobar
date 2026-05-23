import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";

// DELETE — GDPR hard-delete. Cascades to all related records via schema onDelete.
// Uses dbRaw — bypasses soft-delete filter so already-soft-deleted venues can also be purged.
export const DELETE = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (_req, ctx) => {
  const { id } = await ctx.params;

  const venue = await dbRaw.venue.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  // Hard-delete. Schema cascades handle: jobPosts, reviews, engagementRecords,
  // shifts, venueTrustScore, zones relation.
  await dbRaw.venue.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id, name: venue.name });
});
