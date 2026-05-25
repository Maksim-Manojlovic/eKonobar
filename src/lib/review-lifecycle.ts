import { dbRaw } from "@/lib/db";

/**
 * Review state machine — time-based transitions.
 *
 * Publishes all PENDING reviews whose pendingUntil has passed.
 * Called by the publish-reviews cron (every 15 min).
 * Returns the count of newly published reviews.
 */
export async function publishDueReviews(): Promise<number> {
  const now = new Date();
  const result = await dbRaw.review.updateMany({
    where: {
      status: "PENDING",
      pendingUntil: { lte: now },
    },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
    },
  });
  return result.count;
}
