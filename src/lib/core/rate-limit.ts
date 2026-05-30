import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";

// ── Anonymous / pre-auth limiter ──────────────────────────────────────────────
//
// Redis path  (REDIS_URL set): atomic INCR + PEXPIRE — O(1), no DB write per
//   request, no table growth under attack traffic.
// DB fallback (no Redis):      AnonRateLimit table, ON CONFLICT DO UPDATE —
//   identical behaviour, used in tests and environments without Redis.
//
// Key format: "<action>:<value>"  e.g. "login:ip:1.2.3.4", "forgot:1.2.3.4"

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  if (redis) {
    try {
      const windowBucket = Math.floor(Date.now() / windowMs);
      const redisKey     = `rl:${key}:${windowBucket}`;
      const count        = await redis.incr(redisKey);
      // Set TTL only on the first increment — avoids resetting expiry on every hit.
      if (count === 1) await redis.pexpire(redisKey, windowMs + 10_000);
      return count <= max;
    } catch {
      // Transient Redis error — fall through to DB so requests aren't blocked.
    }
  }

  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await dbRaw.$queryRaw<[{ count: bigint }]>`
    INSERT INTO "AnonRateLimit" (key, "windowStart", count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, "windowStart")
    DO UPDATE SET count = "AnonRateLimit".count + 1
    RETURNING count
  `;
  return Number(rows[0].count) <= max;
}

export async function resetRateLimit(key: string): Promise<void> {
  if (redis) {
    try {
      // SCAN-based delete — avoids KEYS blocking the server under large keyspaces.
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `rl:${key}:*`, "COUNT", 100);
        cursor = next;
        if (keys.length > 0) await redis.del(...keys as [string, ...string[]]);
      } while (cursor !== "0");
    } catch {
      // Fall through to DB delete.
    }
  }
  await dbRaw.anonRateLimit.deleteMany({ where: { key } });
}

// ── DB-backed limiter (post-auth write actions) ───────────────────────────────
//
// Redis path  (REDIS_URL set): same INCR + PEXPIRE, key scoped to userId+action.
// DB fallback (no Redis):      RateLimit table upsert.
//
// Actions used in this app:
//   "post_review"  — max 5  per hour
//   "apply_job"    — max 10 per hour
//   "post_invite"  — max 20 per hour

export async function checkRateLimit(
  userId: string,
  action: string,
  max: number,
  windowMs: number = 60 * 60 * 1000,
): Promise<boolean> {
  if (redis) {
    try {
      const windowBucket = Math.floor(Date.now() / windowMs);
      const redisKey     = `rl:auth:${userId}:${action}:${windowBucket}`;
      const count        = await redis.incr(redisKey);
      if (count === 1) await redis.pexpire(redisKey, windowMs + 10_000);
      return count <= max;
    } catch {
      // Transient Redis error — fall through to DB.
    }
  }

  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const record = await dbRaw.rateLimit.upsert({
    where:  { userId_action_windowStart: { userId, action, windowStart } },
    create: { userId, action, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return record.count <= max;
}
