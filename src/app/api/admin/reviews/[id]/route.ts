import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { logAudit } from "@/lib/core/audit";

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { action } = await req.json(); // "publish" | "remove"

  if (action !== "publish" && action !== "remove") {
    return NextResponse.json({ error: "action must be publish or remove" }, { status: 400 });
  }

  const review = await dbRaw.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = action === "publish" ? "PUBLISHED" : "REMOVED";

  const updated = await dbRaw.review.update({
    where: { id },
    data: {
      status: newStatus,
      ...(action === "publish" && { publishedAt: new Date() }),
    },
  });

  // Fire-and-forget score sync
  if (action === "publish") {
    fireSideEffects({
      syncVenueId:  review.direction === "WAITER_TO_VENUE" ? review.venueId : null,
      syncWaiterId: review.direction !== "WAITER_TO_VENUE" ? review.subjectId : null,
    });
  }

  logAudit(session.user.id, action === "publish" ? "REVIEW_PUBLISHED" : "REVIEW_REMOVED", id, "Review");

  return NextResponse.json(updated);
});
