import type { Session } from "next-auth";
import { RED_ALERT_DELAY_MS } from "@/lib/passport/constants";

/**
 * Red Alert visibility — authenticated vs anonymous.
 *
 * Signed-in users see Red Alert posts immediately. Anonymous callers only see a
 * Red Alert once it is RED_ALERT_DELAY_MS old, so the public map and the public
 * job feed cannot be scraped for fresh urgent posts by someone who never
 * registered. Registering is free, so this costs a real waiter nothing.
 *
 * Every surface that exposes or acts on a Red Alert post must gate through this
 * module. The rule previously lived inline in GET /api/jobs alone, which left
 * GET /api/jobs/geojson and POST /api/jobs/applications serving the full
 * undelayed set.
 *
 * Returns the `createdAt` cutoff a Red Alert post must predate to be visible, or
 * `undefined` when the caller sees the full set.
 */
export function getRedAlertCutoff(session: Session | null): Date | undefined {
  if (session) return undefined;
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

/** True when `post` is a Red Alert still inside the caller's embargo window. */
export function isRedAlertEmbargoed(
  post: { redAlert: boolean; createdAt: Date },
  cutoff: Date | undefined,
): boolean {
  if (!cutoff) return false;
  return post.redAlert && post.createdAt > cutoff;
}
