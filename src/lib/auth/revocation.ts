import { dbRaw } from "@/lib/core/db";

// ── In-process token revocation cache ────────────────────────────────────────
// Avoids a DB hit on every getServerSession() call.
//
// TTL is role-stratified:
//   ADMIN  →  5 s  (near-immediate propagation after admin demotion / ban)
//   others → 60 s  (previous behaviour, preserves DB hit rate for most users)
//
// The cache stores the result but TTL is evaluated at read time based on the
// caller-supplied role, so the same Map entry serves both TTLs correctly.
// Eviction uses the longer TTL (60 s) to avoid churn; 5 s admin entries linger
// in the Map but are never served stale — they trigger a fresh DB fetch instead.
//
// Isolated here so the cache lifecycle can be unit-tested without importing
// the full NextAuth config object (authOptions).

const _revCache = new Map<string, { revokedAt: number | null; cachedAt: number }>();

/** Standard cache TTL — applies to all non-ADMIN roles. */
export const REV_CACHE_TTL_MS       = 60_000;
/** Short cache TTL for ADMIN tokens — limits the exploitation window after demotion. */
export const REV_CACHE_TTL_ADMIN_MS =  5_000;

const REV_CACHE_MAX = 5_000;

function evictRevCache(now: number): void {
  for (const [key, entry] of _revCache) {
    if (now - entry.cachedAt >= REV_CACHE_TTL_MS) _revCache.delete(key);
  }
  // Hard cap — if stale eviction wasn't enough, clear everything so the next
  // request cycle starts fresh rather than serving a perpetually-bloated map.
  if (_revCache.size > REV_CACHE_MAX) _revCache.clear();
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
  const now        = Date.now();
  const ttl        = role === "ADMIN" ? REV_CACHE_TTL_ADMIN_MS : REV_CACHE_TTL_MS;
  const cached     = _revCache.get(userId);

  if (cached && now - cached.cachedAt < ttl) {
    return cached.revokedAt !== null && tokenIat < cached.revokedAt;
  }

  const row = await dbRaw.tokenRevocation.findUnique({
    where:  { userId },
    select: { revokedAt: true },
  });

  _revCache.set(userId, {
    revokedAt: row ? row.revokedAt.getTime() / 1000 : null,
    cachedAt:  now,
  });
  evictRevCache(now);

  return row !== null && tokenIat < row.revokedAt.getTime() / 1000;
}

/** Exposed for tests only — clears the cache between test cases. */
export function _clearRevCacheForTests(): void {
  _revCache.clear();
}
