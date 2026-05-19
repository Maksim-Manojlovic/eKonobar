import { dbRaw } from "@/lib/db";

// ── Anonymous / pre-auth limiter ──────────────────────────────────────────────
//
// Backed by AnonRateLimit table — no User FK, works across all instances.
// Key format: "<action>:<value>"  e.g. "login:ip:1.2.3.4", "forgot:1.2.3.4"
// Uses the same hour-bucket strategy as checkRateLimit below.

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const existing = await dbRaw.anonRateLimit.findUnique({
    where: { key_windowStart: { key, windowStart } },
    select: { count: true },
  });

  if (existing && existing.count >= max) return false;

  await dbRaw.anonRateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  return true;
}

export async function resetRateLimit(key: string): Promise<void> {
  await dbRaw.anonRateLimit.deleteMany({ where: { key } });
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
