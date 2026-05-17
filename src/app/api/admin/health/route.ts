import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const guestEmbargo   = new Date(now.getTime() - 2  * 60 * 60 * 1000);   // 2h
  const regularEmbargo = new Date(now.getTime() - 48 * 60 * 60 * 1000);   // 48h

  const [
    overdueGuestReviews,
    overdueRegularReviews,
    expiredPaidPassports,
    lastPublishedReview,
    lastRenewalPayment,
    softDeletedUsers,
    rateLimitEntries,
    pendingClockIns,
  ] = await Promise.all([
    // Guest reviews overdue (PENDING, authorId null, older than 2h)
    dbRaw.review.count({
      where: {
        status: "PENDING",
        authorId: null,
        createdAt: { lt: guestEmbargo },
      },
    }),

    // Non-guest reviews overdue (PENDING, authorId set, older than 48h)
    dbRaw.review.count({
      where: {
        status: "PENDING",
        authorId: { not: null },
        createdAt: { lt: regularEmbargo },
      },
    }),

    // Passports with paid tier but expired subscription (DB stale — runtime treats as FREE)
    dbRaw.waiterPassport.count({
      where: {
        passportTier: { not: "FREE" },
        subscriptionExpiresAt: { lt: now },
      },
    }),

    // Last published review (proxy for publish-reviews cron health)
    dbRaw.review.findFirst({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),

    // Last successful renewal payment (proxy for renew-subscriptions cron health)
    dbRaw.passportPayment.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),

    // Soft-deleted users
    dbRaw.user.count({ where: { deletedAt: { not: null } } }),

    // Rate limit entries (high count = heavy usage or potential abuse)
    dbRaw.rateLimit.count(),

    // Pending clock-in approvals
    dbRaw.shiftAssignment.count({ where: { pendingClockIn: true } }),
  ]);

  return NextResponse.json({
    reviews: {
      overdueGuest:   overdueGuestReviews,
      overdueRegular: overdueRegularReviews,
    },
    passports: {
      expiredPaid: expiredPaidPassports,
    },
    cron: {
      lastPublishedReviewAt:  lastPublishedReview?.publishedAt  ?? null,
      lastRenewalPaymentAt:   lastRenewalPayment?.createdAt     ?? null,
    },
    users: {
      softDeleted: softDeletedUsers,
    },
    system: {
      rateLimitEntries: rateLimitEntries,
      pendingClockIns:  pendingClockIns,
    },
  });
}
