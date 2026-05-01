// In-memory rate limiter — za login (pre autentikacije, userId nije poznat).
// DB-backed RateLimit model se koristi za post-auth akcije (post_review, apply_job).

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/**
 * Vraća true ako je akcija dozvoljena, false ako je limit prekoračen.
 *
 * @param key      - unikatni ključ (npr. "login:email@example.com")
 * @param max      - maksimalan broj pokušaja u prozoru
 * @param windowMs - trajanje prozora u ms
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count += 1;
  return true;
}

/**
 * Ručno resetuje brojač za key — poziva se nakon uspješne prijave.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
