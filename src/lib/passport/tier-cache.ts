import { redis } from "@/lib/core/redis";
import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { getEffectiveTier } from "@/lib/passport/tier";

const CACHE_PREFIX = "passport:tier:";

/**
 * Returns the effective passport tier for a waiter, using a Redis cache to
 * avoid a DB round-trip on every job-list request.
 *
 * TTL is calibrated to the subscription window:
 *   - Active subscription: expires when the subscription expires (max 1h, min 60s)
 *   - FREE / no passport: 5-minute TTL (tier can change on payment)
 *
 * Always call bustTierCache() when the tier or expiry changes.
 */
export async function getEffectiveTierCached(userId: string): Promise<string> {
  const key = `${CACHE_PREFIX}${userId}`;

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached;
    } catch {
      // Redis error — fall through to DB.
    }
  }

  const passport = await db.waiterPassport.findUnique({
    where:  { userId },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  const tier   = getEffectiveTier(passport);
  const expiry = passport?.subscriptionExpiresAt;

  if (redis) {
    const ttlSec = expiry && expiry > new Date()
      ? Math.min(3600, Math.max(60, Math.floor((expiry.getTime() - Date.now()) / 1000)))
      : 300;
    redis
      .set(key, tier, "EX", ttlSec)
      .catch((err) => logger.warn({ err, userId }, "tier-cache: write failed"));
  }

  return tier;
}

/** Call after any tier or subscription change for this user. */
export function bustTierCache(userId: string): void {
  if (!redis) return;
  redis
    .del(`${CACHE_PREFIX}${userId}`)
    .catch((err) => logger.warn({ err, userId }, "tier-cache: bust failed"));
}
