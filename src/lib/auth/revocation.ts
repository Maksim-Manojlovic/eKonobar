import { dbRaw } from "@/lib/core/db";

// ── In-process token revocation cache ────────────────────────────────────────
// Avoids a DB hit on every getServerSession() call.
// TTL of 60s means role changes propagate within one minute.
//
// Isolated here so the cache lifecycle can be unit-tested without importing
// the full NextAuth config object (authOptions).

const _revCache = new Map<string, { revokedAt: number | null; cachedAt: number }>();
const REV_CACHE_TTL_MS = 60_000;
const REV_CACHE_MAX    = 5_000;

function evictRevCache(now: number): void {
  for (const [key, entry] of _revCache) {
    if (now - entry.cachedAt >= REV_CACHE_TTL_MS) _revCache.delete(key);
  }
  // Hard cap — if stale eviction wasn't enough, clear everything so the next
  // request cycle starts fresh rather than serving a perpetually-bloated map.
  if (_revCache.size > REV_CACHE_MAX) _revCache.clear();
}

export async function isTokenRevoked(userId: string, tokenIat: number): Promise<boolean> {
  const now = Date.now();
  const cached = _revCache.get(userId);
  if (cached && now - cached.cachedAt < REV_CACHE_TTL_MS) {
    return cached.revokedAt !== null && tokenIat < cached.revokedAt;
  }
  const row = await dbRaw.tokenRevocation.findUnique({ where: { userId }, select: { revokedAt: true } });
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
