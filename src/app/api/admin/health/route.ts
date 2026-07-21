import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";

export const GET = withRole("ADMIN", async () => {
  const now = new Date();
  const guestEmbargo   = new Date(now.getTime() - 2  * 60 * 60 * 1000);   // 2h
  const regularEmbargo = new Date(now.getTime() - 48 * 60 * 60 * 1000);   // 48h

  const [
    overdueGuestReviews,
    overdueRegularReviews,
    lastPublishedReview,
    softDeletedUsers,
    rateLimitEntries,
    pendingClockIns,
    redisHealth,
    dbHealth,
  ] = await Promise.all([
    dbRaw.review.count({
      where: { status: "PENDING", authorId: null, createdAt: { lt: guestEmbargo } },
    }),
    dbRaw.review.count({
      where: { status: "PENDING", authorId: { not: null }, createdAt: { lt: regularEmbargo } },
    }),
    dbRaw.review.findFirst({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
    dbRaw.user.count({ where: { deletedAt: { not: null } } }),
    dbRaw.rateLimit.count(),
    dbRaw.shiftAssignment.count({ where: { pendingClockIn: true } }),
    // Redis connectivity check — null when REDIS_URL is not configured.
    redis
      ? (async () => {
          const t0 = Date.now();
          try {
            await redis.ping();
            return { connected: true, latencyMs: Date.now() - t0 };
          } catch {
            return { connected: false, latencyMs: null };
          }
        })()
      : Promise.resolve(null),
    // DB saturation (Golden Signal: Saturation). Live round-trip latency is the
    // portable proxy — it climbs once the Prisma pool is exhausted and requests
    // queue on pool_timeout. If the metrics preview is enabled, surface the real
    // busy/open gauges too (defensive: $metrics is absent without that feature).
    (async () => {
      const t0 = Date.now();
      let pingMs: number | null = null;
      try {
        await dbRaw.$queryRaw`SELECT 1`;
        pingMs = Date.now() - t0;
      } catch {
        /* pingMs stays null → probe failed */
      }
      const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metricsApi = (dbRaw as any).$metrics;
      let connectionsOpen: number | null = null;
      let connectionsBusy: number | null = null;
      if (metricsApi?.json) {
        try {
          const m = await metricsApi.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gauge = (key: string) => m.gauges?.find((g: any) => g.key === key)?.value ?? null;
          connectionsOpen = gauge("prisma_pool_connections_open");
          connectionsBusy = gauge("prisma_pool_connections_busy");
        } catch {
          /* metrics unavailable — leave nulls */
        }
      }
      const saturation =
        connectionsBusy !== null && poolSize > 0 ? connectionsBusy / poolSize : null;
      return { pingMs, poolSize, connectionsOpen, connectionsBusy, saturation };
    })(),
  ]);

  return NextResponse.json({
    reviews: {
      overdueGuest:   overdueGuestReviews,
      overdueRegular: overdueRegularReviews,
    },
    cron: {
      lastPublishedReviewAt: lastPublishedReview?.publishedAt ?? null,
    },
    users: {
      softDeleted: softDeletedUsers,
    },
    system: {
      rateLimitEntries: rateLimitEntries,
      pendingClockIns:  pendingClockIns,
    },
    redis: redisHealth,
    db: dbHealth,
  });
});
