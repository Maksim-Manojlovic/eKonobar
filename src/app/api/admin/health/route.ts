import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";

export const GET = withRole("ADMIN", async () => {
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
    dbRaw.review.count({
      where: { status: "PENDING", authorId: null, createdAt: { lt: guestEmbargo } },
    }),
    dbRaw.review.count({
      where: { status: "PENDING", authorId: { not: null }, createdAt: { lt: regularEmbargo } },
    }),
    dbRaw.waiterPassport.count({
      where: { passportTier: { not: "FREE" }, subscriptionExpiresAt: { lt: now } },
    }),
    dbRaw.review.findFirst({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
    dbRaw.passportPayment.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    dbRaw.user.count({ where: { deletedAt: { not: null } } }),
    dbRaw.rateLimit.count(),
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
});
