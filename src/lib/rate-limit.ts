import { dbRaw } from "@/lib/db";

// ── In-memory limiter (pre-auth, e.g. login) ──────────────────────────────────

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

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

export function resetRateLimit(key: string): void {
  store.delete(key);
}

// ── DB-backed limiter (post-auth write actions) ───────────────────────────────
//
// Limits are per user+action per time window.
// windowMs is bucketed (floored), so all requests in the same bucket share
// a counter. Default window: 1 hour.
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
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const existing = await dbRaw.rateLimit.findFirst({
    where: { userId, action, windowStart },
    select: { count: true },
  });

  if (existing && existing.count >= max) return false;

  await dbRaw.rateLimit.upsert({
    where: { userId_action_windowStart: { userId, action, windowStart } },
    create: { userId, action, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  return true;
}
