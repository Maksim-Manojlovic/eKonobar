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
    // Users grouped by role (exclude soft-deleted)
    dbRaw.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),

    // Passports grouped by tier
    dbRaw.waiterPassport.groupBy({ by: ["passportTier"], _count: { _all: true } }),

    // Waiters currently available
    dbRaw.waiterPassport.count({ where: { currentlyAvailable: true } }),

    // Waiters with GOLD or ID_VERIFIED
    dbRaw.user.count({
      where: {
        role: "WAITER",
        deletedAt: null,
        verificationTier: { in: ["GOLD", "ID_VERIFIED"] },
      },
    }),

    // Active venues (not deleted)
    dbRaw.venue.count({ where: { deletedAt: null } }),

    // Open job posts
    dbRaw.jobPost.count({ where: { deletedAt: null, status: "ACTIVE" } }),

    // Red alert open jobs
    dbRaw.jobPost.count({ where: { deletedAt: null, status: "ACTIVE", redAlert: true } }),

    // Total applications
    dbRaw.jobApplication.count(),

    // Pending applications
    dbRaw.jobApplication.count({ where: { status: "PENDING" } }),

    // Reviews grouped by status
    dbRaw.review.groupBy({ by: ["status"], _count: { _all: true } }),

    // Pending sanitary book verifications
    dbRaw.sanitaryBook.count({ where: { status: "PENDING" } }),

    // Total successful payments
    dbRaw.passportPayment.count({ where: { status: "SUCCESS" } }),

    // Revenue this month (SUCCESS payments, amountRsd in minor units = paras, /100 = dinars)
    dbRaw.passportPayment.aggregate({
      where: { status: "SUCCESS", createdAt: { gte: monthStart } },
      _sum: { amountRsd: true },
    }),
  ]);

  const roleMap = Object.fromEntries(
    usersByRole.map((r) => [r.role, r._count._all])
  );

  const tierMap = Object.fromEntries(
    passportsByTier.map((r) => [r.passportTier, r._count._all])
  );

  const reviewMap = Object.fromEntries(
    reviewsByStatus.map((r) => [r.status, r._count._all])
  );

  return NextResponse.json({
    users: {
      waiters:      roleMap["WAITER"]       ?? 0,
      venueOwners:  roleMap["VENUE_OWNER"]  ?? 0,
      headhunters:  roleMap["HEADHUNTER"]   ?? 0,
      admins:       roleMap["ADMIN"]        ?? 0,
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
      totalSuccess:      paymentsSuccess,
      revenueThisMonth:  Math.round((revenueThisMonth._sum.amountRsd ?? 0) / 100),
    },
  });
}
