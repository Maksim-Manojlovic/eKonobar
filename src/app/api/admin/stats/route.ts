import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";

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

type StatsPayload = Awaited<ReturnType<typeof fetchStats>>;

const STATS_CACHE_KEY = "cache:admin:stats";
const STATS_CACHE_TTL = 60; // seconds — same as the previous unstable_cache revalidate

async function getCachedStats(): Promise<StatsPayload> {
  if (redis) {
    try {
      const cached = await redis.get(STATS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as StatsPayload;
    } catch {
      // Redis error — fall through to direct DB query.
    }
  }

  const stats = await fetchStats();

  if (redis) {
    // Fire-and-forget cache write — failure is non-fatal.
    redis.set(STATS_CACHE_KEY, JSON.stringify(stats), "EX", STATS_CACHE_TTL).catch(() => {});
  }

  return stats;
}

export const GET = withRole("ADMIN", async () => {
  const stats = await getCachedStats();
  return NextResponse.json(stats);
});
