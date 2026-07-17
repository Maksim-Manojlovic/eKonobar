import type { Session } from "next-auth";
import { getEffectiveTierCached } from "@/lib/passport/tier-cache";
import { RED_ALERT_DELAY_MS } from "@/lib/passport/constants";

/**
 * Red Alert early access — the headline paid PRO/PRO_PLUS feature.
 *
 * FREE waiters may only see, and only apply to, a Red Alert post once it is
 * RED_ALERT_DELAY_MS old. Every surface that exposes or acts on a Red Alert post
 * must gate through this module. The rule previously lived inline in
 * GET /api/jobs alone, which left GET /api/jobs/geojson and
 * POST /api/jobs/applications serving the full undelayed set.
 *
 * Returns the `createdAt` cutoff a Red Alert post must predate to be visible, or
 * `undefined` when the caller is entitled to the full set.
 */
export async function getRedAlertCutoff(session: Session | null): Promise<Date | undefined> {
  // Owners, headhunters and admins are not the audience for waiter early access.
  if (session && session.user.role !== "WAITER") return undefined;

  // Unauthenticated callers are treated as FREE. Without this a FREE waiter signs
  // out (or reads the public map GeoJSON) and gets the same posts with no delay,
  // which makes the gate on every other surface pointless.
  if (!session) return redAlertCutoff();

  const tier = await getEffectiveTierCached(session.user.id);
  return tier === "FREE" ? redAlertCutoff() : undefined;
}

function redAlertCutoff(): Date {
  return new Date(Date.now() - RED_ALERT_DELAY_MS);
}

/**
 * Prisma JobPost visibility clauses for a cutoff, as an array meant to be spread
 * into an `AND`.
 *
 * Deliberately not a bare `{ OR: [...] }` object: a route that spreads both this
 * and a search `{ OR: [...] }` into one where-object silently drops the first —
 * duplicate JS keys overwrite. Composing under `AND` keeps both live.
 */
export function redAlertVisibilityFilter(cutoff: Date | undefined) {
  if (!cutoff) return [];
  return [
    {
      OR: [
        { redAlert: false },
        { redAlert: true, createdAt: { lte: cutoff } },
      ],
    },
  ];
}

/** True when `post` is a Red Alert still inside the caller's early-access embargo. */
export function isRedAlertEmbargoed(
  post: { redAlert: boolean; createdAt: Date },
  cutoff: Date | undefined,
): boolean {
  if (!cutoff) return false;
  return post.redAlert && post.createdAt > cutoff;
}
