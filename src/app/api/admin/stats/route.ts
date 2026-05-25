import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";

async function fetchStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    usersByRole,
    passportsByTier,
    availableWaiters,
    verifiedWaiters,
    activeVenues,
    openJobs,
    redAlertJobs,
    totalApplications,
    pendingApplications,
    reviewsByStatus,
    pendingSanitary,
    paymentsSuccess,
    revenueThisMonth,
  ] = await Promise.all([
    dbRaw.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
    dbRaw.waiterPassport.groupBy({ by: ["passportTier"], _count: { _all: true } }),
    dbRaw.waiterPassport.count({ where: { currentlyAvailable: true } }),
    dbRaw.user.count({
      where: {
        role: "WAITER",
        deletedAt: null,
        verificationTier: { in: ["GOLD", "ID_VERIFIED"] },
      },
    }),
    dbRaw.venue.count({ where: { deletedAt: null } }),
    dbRaw.jobPost.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    dbRaw.jobPost.count({ where: { deletedAt: null, status: "ACTIVE", redAlert: true } }),
    dbRaw.jobApplication.count(),
    dbRaw.jobApplication.count({ where: { status: "PENDING" } }),
    dbRaw.review.groupBy({ by: ["status"], _count: { _all: true } }),
    dbRaw.sanitaryBook.count({ where: { status: "PENDING" } }),
    dbRaw.passportPayment.count({ where: { status: "SUCCESS" } }),
    dbRaw.passportPayment.aggregate({
      where: { status: "SUCCESS", createdAt: { gte: monthStart } },
      _sum: { amountRsd: true },
    }),
  ]);

  const roleMap   = Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all]));
  const tierMap   = Object.fromEntries(passportsByTier.map((r) => [r.passportTier, r._count._all]));
  const reviewMap = Object.fromEntries(reviewsByStatus.map((r) => [r.status, r._count._all]));

  return {
    users: {
      waiters:     roleMap["WAITER"]      ?? 0,
      venueOwners: roleMap["VENUE_OWNER"] ?? 0,
      headhunters: roleMap["HEADHUNTER"]  ?? 0,
      admins:      roleMap["ADMIN"]       ?? 0,
      total: Object.values(roleMap).reduce((a, b) => a + b, 0),
    },
    passports: {
      total:    (tierMap["FREE"] ?? 0) + (tierMap["PRO"] ?? 0) + (tierMap["PRO_PLUS"] ?? 0),
      free:     tierMap["FREE"]     ?? 0,
      pro:      tierMap["PRO"]      ?? 0,
      proPlus:  tierMap["PRO_PLUS"] ?? 0,
      available: availableWaiters,
      verified:  verifiedWaiters,
    },
    venues:       activeVenues,
    jobs: {
      open:     openJobs,
      redAlert: redAlertJobs,
    },
    applications: {
      total:   totalApplications,
      pending: pendingApplications,
    },
    reviews: {
      pending:   reviewMap["PENDING"]   ?? 0,
      published: reviewMap["PUBLISHED"] ?? 0,
      disputed:  reviewMap["DISPUTED"]  ?? 0,
      removed:   reviewMap["REMOVED"]   ?? 0,
    },
    sanitary: {
      pending: pendingSanitary,
    },
    payments: {
      totalSuccess:     paymentsSuccess,
      revenueThisMonth: Math.round((revenueThisMonth._sum.amountRsd ?? 0) / 100),
    },
  };
}

// Cache for 60 seconds — admin stats don't need to be real-time to the second,
// and 13 parallel DB queries on every page load is expensive at scale.
const getCachedStats = unstable_cache(fetchStats, ["admin-stats"], { revalidate: 60 });

export const GET = withRole("ADMIN", async () => {
  const stats = await getCachedStats();
  return NextResponse.json(stats);
});
