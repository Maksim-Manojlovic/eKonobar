import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseQuery } from "@/lib/auth/parse-body";
import { canManageShifts } from "@/lib/shifts/auth";
import { redis } from "@/lib/core/redis";
import logger from "@/lib/core/logger";
import {
  computeWaiterAnalytics,
  type RawAssignment,
  type RawPassport,
  type RawGuestReview,
  type RawSwap,
} from "@/lib/analytics/waiter-analytics";

// Prisma row → RawAssignment mapper (shared by current + previous windows).
type AssignmentRow = {
  waiterId: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  lateMinutes: number | null;
  earlyExitAt: Date | null;
  cancelledLate: boolean;
  waiter: { name: string | null } | null;
  shift: { date: Date; scheduledStart: Date | null };
};
const toRaw = (a: AssignmentRow): RawAssignment => ({
  waiterId: a.waiterId,
  waiterName: a.waiter?.name ?? null,
  clockInAt: a.clockInAt,
  clockOutAt: a.clockOutAt,
  lateMinutes: a.lateMinutes,
  earlyExitAt: a.earlyExitAt,
  cancelledLate: a.cancelledLate,
  shiftScheduledStart: a.shift.scheduledStart,
  shiftDate: a.shift.date,
});

const ASSIGNMENT_SELECT = {
  waiterId: true,
  clockInAt: true,
  clockOutAt: true,
  lateMinutes: true,
  earlyExitAt: true,
  cancelledLate: true,
  waiter: { select: { name: true } },
  shift: { select: { date: true, scheduledStart: true } },
} as const;

type Ctx = { params: Promise<{ id: string }> };

const QuerySchema = z.object({
  period: z.coerce.number().int().refine((n) => n === 7 || n === 30 || n === 90, {
    message: "period must be 7, 30 or 90",
  }).default(30),
});

const CACHE_TTL = 300; // 5 min

/**
 * GET /api/venues/[id]/waiter-analytics?period=30
 *
 * Owner-or-head-waiter reliability analytics for a venue's roster.
 * Aggregates shift attendance + sanitary compliance over the window.
 */
export const GET = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id: venueId } = await ctx.params;

  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;
  const period = parsed.data.period ?? 30;

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { id: true, ownerId: true, headWaiterId: true },
  });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!canManageShifts(session.user.id, session.user.role, venue)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cacheKey = `analytics:venue:${venueId}:${period}`;
  if (redis) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) return NextResponse.json(JSON.parse(hit));
    } catch (err) {
      logger.warn({ err, venueId }, "waiter-analytics cache read failed");
    }
  }

  const windowMs = period * 24 * 3_600_000;
  const since = new Date(Date.now() - windowMs);        // current window start
  const prevSince = new Date(Date.now() - 2 * windowMs); // previous window start

  // Current + previous window assignments (previous powers the trend delta).
  const [currentRows, previousRows] = await Promise.all([
    db.shiftAssignment.findMany({
      where: { shift: { venueId, date: { gte: since } } },
      select: ASSIGNMENT_SELECT,
    }),
    db.shiftAssignment.findMany({
      where: { shift: { venueId, date: { gte: prevSince, lt: since } } },
      select: ASSIGNMENT_SELECT,
    }),
  ]);

  const waiterIds = [...new Set(currentRows.map((a) => a.waiterId))];

  // Passports + this-window guest reviews + swap requests for the current roster.
  const [passportRows, guestReviewRows, swapRows] = await Promise.all([
    waiterIds.length
      ? db.waiterPassport.findMany({
          where: { userId: { in: waiterIds } },
          select: { userId: true, sanitaryBookValid: true, sanitaryExpiry: true },
        })
      : Promise.resolve([]),
    waiterIds.length
      ? db.review.findMany({
          where: {
            venueId,
            direction: "GUEST_TO_WAITER",
            status: "PUBLISHED",
            subjectId: { in: waiterIds },
            publishedAt: { gte: since },
          },
          select: {
            subjectId: true,
            overallRating: true,
            ratingFriendliness: true,
            ratingGuestSpeed: true,
            ratingAttentiveness: true,
          },
        })
      : Promise.resolve([]),
    waiterIds.length
      ? db.shiftSwapRequest.findMany({
          where: {
            requestedAt: { gte: since },
            fromAssignment: { waiterId: { in: waiterIds }, shift: { venueId } },
          },
          select: { requestedAt: true, fromAssignment: { select: { waiterId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const assignments: RawAssignment[] = currentRows.map(toRaw);
  const previousAssignments: RawAssignment[] = previousRows.map(toRaw);

  const passports: RawPassport[] = passportRows.map((p) => ({
    userId: p.userId,
    sanitaryBookValid: p.sanitaryBookValid,
    sanitaryExpiry: p.sanitaryExpiry,
  }));

  const guestReviews: RawGuestReview[] = guestReviewRows
    .filter((r) => r.subjectId !== null)
    .map((r) => ({
      waiterId: r.subjectId as string,
      overallRating: r.overallRating,
      ratingFriendliness: r.ratingFriendliness,
      ratingGuestSpeed: r.ratingGuestSpeed,
      ratingAttentiveness: r.ratingAttentiveness,
    }));

  const swaps: RawSwap[] = swapRows.map((s) => ({
    waiterId: s.fromAssignment.waiterId,
    requestedAt: s.requestedAt,
  }));

  const result = computeWaiterAnalytics(assignments, passports, period, new Date(), {
    previousAssignments,
    guestReviews,
    swaps,
  });

  if (redis) {
    redis
      .set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL)
      .catch((err) => logger.warn({ err, venueId }, "waiter-analytics cache write failed"));
  }

  return NextResponse.json(result);
});
