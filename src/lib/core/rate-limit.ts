import { dbRaw } from "@/lib/core/db";

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

  // Atomic upsert: increment first, then check — no TOCTOU race between concurrent requests.
  // Counter keeps incrementing past max (rejected requests still count), which is intentional:
  // it makes the limit slightly more aggressive under burst, never more permissive.
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

  // Prisma upsert maps to INSERT ... ON CONFLICT DO UPDATE in PostgreSQL —
  // fully atomic, no TOCTOU. Using Prisma client (not $queryRaw) so that
  // Prisma generates the `id` (cuid) for the INSERT path. The raw SQL
  // approach was missing `id` and would throw a not-null violation on first
  // insert because @default(cuid()) is application-side only.
  const record = await dbRaw.rateLimit.upsert({
    where:  { userId_action_windowStart: { userId, action, windowStart } },
    create: { userId, action, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return record.count <= max;
}
