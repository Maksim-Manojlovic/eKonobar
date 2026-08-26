import Redis from "ioredis";
import logger from "@/lib/core/logger";

const globalForRedis = globalThis as unknown as { _redis?: Redis | null };

function createClient(): Redis | null {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;

  // Defensive parse: strip whitespace and any wrapping quotes (a common paste
  // mistake in dashboard env vars — `"rediss://..."` is stored with the quotes).
  const url = raw.trim().replace(/^['"]|['"]$/g, "");

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      // Don't dial at construction — avoids a connection attempt during `next build`
      // page-data collection and on every serverless cold start until Redis is used.
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    client.on("error", (err) => logger.error({ err }, "redis error"));
    return client;
  } catch (err) {
    // Invalid REDIS_URL (e.g. ERR_INVALID_URL) must not crash the build or boot —
    // degrade to the no-Redis DB path, same as when REDIS_URL is unset.
    logger.error({ err }, "redis init failed — REDIS_URL invalid, falling back to no-Redis");
    return null;
  }
}

// Cache on globalThis — survives Next.js HMR hot-reloads (same pattern as Prisma).
if (globalForRedis._redis === undefined) {
  globalForRedis._redis = createClient();
}

export const redis: Redis | null = globalForRedis._redis ?? null;
