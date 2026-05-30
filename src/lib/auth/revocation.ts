import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";

// ── In-process fallback cache ─────────────────────────────────────────────────
//
// Used when Redis is not configured (unit tests, local dev without Redis).
// When Redis IS available, this Map is never consulted — Redis is the shared
// cache across all instances, which fixes the cross-process staleness problem.
//
// TTL is role-stratified:
//   ADMIN  →  5 s  (near-immediate propagation after admin demotion / ban)
//   others → 60 s  (previous behaviour, preserves DB hit rate for most users)

const _fallbackCache = new Map<string, { revokedAt: number | null; cachedAt: number }>();

export const REV_CACHE_TTL_MS       = 60_000;
export const REV_CACHE_TTL_ADMIN_MS =  5_000;

const REV_CACHE_MAX = 5_000;

function evictFallbackCache(now: number): void {
  for (const [key, entry] of _fallbackCache) {
    if (now - entry.cachedAt >= REV_CACHE_TTL_MS) _fallbackCache.delete(key);
  }
  if (_fallbackCache.size > REV_CACHE_MAX) _fallbackCache.clear();
}

/**
 * Returns true when the token (identified by userId + tokenIat) has been revoked.
 *
 * @param role - JWT role of the token being checked. ADMIN tokens use a shorter
 *               cache TTL (5 s) so that admin demotion or ban propagates faster.
 */
export async function isTokenRevoked(
  userId: string,
  tokenIat: number,
  role?: string,
): Promise<boolean> {
  const ttl    = role === "ADMIN" ? REV_CACHE_TTL_ADMIN_MS : REV_CACHE_TTL_MS;
  const ttlSec = ttl / 1000;
  const key    = `token:rev:${userId}`;

  // ── Redis path — shared across all instances ─────────────────────────────
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        // "none" means the DB confirmed no revocation exists for this user.
        if (cached === "none") return false;
        return tokenIat < Number(cached);
      }
    } catch {
      // Transient Redis error — fall through to DB (no in-process cache used
      // when Redis is configured, to avoid serving a stale local copy).
    }

    const row = await dbRaw.tokenRevocation.findUnique({
      where:  { userId },
      select: { revokedAt: true },
    });

    const revokedAtSec = row ? row.revokedAt.getTime() / 1000 : null;

    // Fire-and-forget cache write — failure is non-fatal.
    redis
      .set(key, revokedAtSec === null ? "none" : String(revokedAtSec), "EX", ttlSec)
      .catch(() => {});

    return row !== null && tokenIat < revokedAtSec!;
  }

  // ── In-process fallback path — no Redis (unit tests / dev) ───────────────
  const now    = Date.now();
  const cached = _fallbackCache.get(userId);

  if (cached && now - cached.cachedAt < ttl) {
    return cached.revokedAt !== null && tokenIat < cached.revokedAt;
  }

  const row = await dbRaw.tokenRevocation.findUnique({
    where:  { userId },
    select: { revokedAt: true },
  });

  _fallbackCache.set(userId, {
    revokedAt: row ? row.revokedAt.getTime() / 1000 : null,
    cachedAt:  now,
  });
  evictFallbackCache(now);

  return row !== null && tokenIat < row.revokedAt.getTime() / 1000;
}

/** Exposed for tests only — clears the in-process fallback cache. */
export function _clearRevCacheForTests(): void {
  _fallbackCache.clear();
  // Integration tests against a real Redis should call redis.flushdb() in their
  // own setup; this function intentionally stays synchronous and Map-only.
}
