import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";

export const GET = withRole<{ params: Promise<{ id: string }> }>("VENUE_OWNER", async (_req, ctx, session) => {
  const { id } = await ctx.params;

  const venue = await db.venue.findUnique({ where: { id }, select: { ownerId: true } });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (venue.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await db.review.findMany({
    where: {
      venueId: id,
      direction: { in: ["WAITER_TO_VENUE", "GUEST_TO_WAITER", "GUEST_TO_VENUE"] },
      status: { not: "REMOVED" },
    },
    select: {
      id: true,
      direction: true,
      status: true,
      overallRating: true,
      comment: true,
      guestHandle: true,
      createdAt: true,
      publishedAt: true,
      pendingUntil: true,
      author: { select: { name: true, verificationTier: true } },
      subject: { select: { name: true, image: true } },
      ratingAtmosphere: true,
      ratingOrganization: true,
      ratingHygieneWork: true,
      ratingFriendliness: true,
      ratingGuestSpeed: true,
      ratingAttentiveness: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(reviews);
});
