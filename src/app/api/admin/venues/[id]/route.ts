import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

// DELETE — GDPR hard-delete. Cascades to all related records via schema onDelete.
// Uses dbRaw — bypasses soft-delete filter so already-soft-deleted venues can also be purged.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const venue = await dbRaw.venue.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  // Hard-delete. Schema cascades handle: jobPosts, reviews, engagementRecords,
  // shifts, venueTrustScore, zones relation.
  await dbRaw.venue.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id, name: venue.name });
}
