import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";
import { syncVenueTrustScore, syncPassportScore } from "@/lib/sync-scores";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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
    if (review.direction === "WAITER_TO_VENUE" && review.venueId) {
      syncVenueTrustScore(review.venueId).catch(console.error);
    } else if (review.subjectId) {
      syncPassportScore(review.subjectId).catch(console.error);
    }
  }

  logAudit(session.user.id, action === "publish" ? "REVIEW_PUBLISHED" : "REVIEW_REMOVED", id, "Review");

  return NextResponse.json(updated);
}
