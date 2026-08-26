/**
 * Roster authorization.
 *
 * Split on purpose: hiring is an owner decision, but a head waiter / head chef
 * needs to *see* their team to schedule it. So reads are wider than writes.
 *
 * Department-scoped shift rights (head chef edits kitchen shifts, head waiter
 * edits floor shifts) are a separate concern and live in lib/shifts/auth.ts —
 * `Venue.headChefId` is assignable now but not yet load-bearing there.
 */
import type { StaffDepartment } from "@prisma/client";

export type VenueRosterAuthInfo = {
  ownerId:      string;
  headWaiterId: string | null;
  headChefId:   string | null;
};

/** Owner only. Hiring, ending employment, and changing someone's position. */
export function canManageRoster(userId: string, role: string, venue: VenueRosterAuthInfo): boolean {
  return role === "VENUE_OWNER" && venue.ownerId === userId;
}

/** Owner, head waiter, or head chef. Needed to build a schedule. */
export function canViewRoster(userId: string, role: string, venue: VenueRosterAuthInfo): boolean {
  if (canManageRoster(userId, role, venue)) return true;
  return role === "WAITER" && (venue.headWaiterId === userId || venue.headChefId === userId);
}

/**
 * Which department a user leads at this venue, or null if they lead none.
 * Used to scope what a head sees when they are not the owner.
 */
export function ledDepartment(
  userId: string,
  role: string,
  venue: VenueRosterAuthInfo,
): StaffDepartment | null {
  if (role !== "WAITER") return null;
  if (venue.headChefId   === userId) return "BOH";
  if (venue.headWaiterId === userId) return "FOH";
  return null;
}
