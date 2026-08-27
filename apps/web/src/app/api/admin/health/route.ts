import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";

/**
 * Shape of the Prisma `$metrics` API, which is only present when the `metrics`
 * preview feature is enabled — so it is absent from the generated client type.
 * Declared structurally rather than reached for with `any`.
 */
type PrismaMetricsApi = {
  json(): Promise<{ gauges?: { key: string; value: number }[] }>;
};

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
            // This IS the health probe — `connected: false` is the reported result,
            // not a swallowed failure. Logging here would duplicate the response.
            // eslint-disable-next-line no-restricted-syntax
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
        // Probe result, not a swallow: a null pingMs is what the endpoint reports.
        // eslint-disable-next-line no-restricted-syntax
      } catch {
        /* pingMs stays null → probe failed */
      }
      const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 3);
      // `$metrics` only exists when the Prisma `metrics` preview feature is on, so
      // it is genuinely absent from the generated client type. Narrow structural
      // interface instead of `any` — keeps the gauge lookup below type-checked.
      const metricsApi = (dbRaw as unknown as { $metrics?: PrismaMetricsApi }).$metrics;
      let connectionsOpen: number | null = null;
      let connectionsBusy: number | null = null;
      if (metricsApi?.json) {
        try {
          const m = await metricsApi.json();
          const gauge = (key: string) => m.gauges?.find((g) => g.key === key)?.value ?? null;
          connectionsOpen = gauge("prisma_pool_connections_open");
          connectionsBusy = gauge("prisma_pool_connections_busy");
          // Gauges are optional telemetry — nulls are a valid reported state.
          // eslint-disable-next-line no-restricted-syntax
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
