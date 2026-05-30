import Redis from "ioredis";
import logger from "@/lib/core/logger";

const globalForRedis = globalThis as unknown as { _redis?: Redis | null };

function createClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  client.on("error", (err) => logger.error({ err }, "redis error"));
  return client;
}

// Cache on globalThis — survives Next.js HMR hot-reloads (same pattern as Prisma).
if (globalForRedis._redis === undefined) {
  globalForRedis._redis = createClient();
}

export const redis: Redis | null = globalForRedis._redis ?? null;
