import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { logAudit } from "@/lib/core/audit";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const AdminReviewPatchSchema = z.object({
  action: z.enum(["publish", "remove"]),
});

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(AdminReviewPatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

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
