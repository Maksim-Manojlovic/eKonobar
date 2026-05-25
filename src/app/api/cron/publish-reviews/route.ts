import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/core/db";
import { publishDueReviews } from "@/lib/scoring/review-lifecycle";
import { syncVenueTrustScore, syncPassportScore } from "@/lib/scoring/sync";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import logger from "@/lib/core/logger";

// Accepts GET or POST.
// Requires: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron:  set CRON_SECRET env var, add to vercel.json crons config
// Other:        hit with any HTTP scheduler, pass the header

async function run() {
  const now = new Date();

  // Purge rate limit entries older than 24h — both tables accumulate indefinitely otherwise
  const rateLimitCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await Promise.all([
    dbRaw.anonRateLimit.deleteMany({ where: { windowStart: { lt: rateLimitCutoff } } }),
    dbRaw.rateLimit.deleteMany({ where: { windowStart: { lt: rateLimitCutoff } } }),
  ]);

  // Snapshot which reviews are about to be published so we know what to sync
  const dueReviews = await dbRaw.review.findMany({
    where: { status: "PENDING", pendingUntil: { lte: now } },
    select: { venueId: true, subjectId: true, direction: true },
  });

  const published = await publishDueReviews();

  if (published === 0) {
    return { published: 0, venuesSynced: 0, waitersSynced: 0 };
  }

  const venueIds  = new Set<string>();
  const waiterIds = new Set<string>();

  for (const r of dueReviews) {
    if (r.direction === "WAITER_TO_VENUE" && r.venueId)   venueIds.add(r.venueId);
    if ((r.direction === "VENUE_TO_WAITER" || r.direction === "GUEST_TO_WAITER") && r.subjectId) {
      waiterIds.add(r.subjectId);
    }
  }

  await Promise.all([
    ...[...venueIds].map(id   => syncVenueTrustScore(id).catch(err => logger.error({ err, venueId: id },  "syncVenueTrustScore failed in publish-reviews cron"))),
    ...[...waiterIds].map(id  => syncPassportScore(id).catch(err  => logger.error({ err, waiterId: id }, "syncPassportScore failed in publish-reviews cron"))),
  ]);

  return {
    published,
    venuesSynced:  venueIds.size,
    waitersSynced: waiterIds.size,
  };
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}
