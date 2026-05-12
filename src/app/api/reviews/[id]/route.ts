import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncVenueTrustScore, syncPassportScore } from "@/lib/sync-scores";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const review = await db.review.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      direction: true,
      venueId: true,
      subjectId: true,
      venue: { select: { ownerId: true } },
    },
  });

  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!review.venue || review.venue.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (review.status !== "PENDING") {
    return NextResponse.json({ error: "Only PENDING reviews can be moderated" }, { status: 400 });
  }

  if (action === "approve") {
    await db.review.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    if (review.venueId && (review.direction === "WAITER_TO_VENUE" || review.direction === "GUEST_TO_VENUE")) {
      syncVenueTrustScore(review.venueId).catch(console.error);
    }
    if (review.subjectId && (review.direction === "VENUE_TO_WAITER" || review.direction === "GUEST_TO_WAITER")) {
      syncPassportScore(review.subjectId).catch(console.error);
    }
  } else {
    await db.review.update({
      where: { id },
      data: { status: "REMOVED" },
    });
  }

  return NextResponse.json({ ok: true });
}
