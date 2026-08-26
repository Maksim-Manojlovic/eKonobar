import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ReviewModeratePatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("VENUE_OWNER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(ReviewModeratePatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

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
    fireSideEffects({
      syncVenueId: (review.venueId && (review.direction === "WAITER_TO_VENUE" || review.direction === "GUEST_TO_VENUE"))
        ? review.venueId : null,
      syncWaiterId: (review.subjectId && (review.direction === "VENUE_TO_WAITER" || review.direction === "GUEST_TO_WAITER"))
        ? review.subjectId : null,
    });
  } else {
    await db.review.update({
      where: { id },
      data: { status: "REMOVED" },
    });
  }

  return NextResponse.json({ ok: true });
});
