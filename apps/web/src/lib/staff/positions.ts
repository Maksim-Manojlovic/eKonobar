/**
 * Staff positions and departments — single source of truth.
 *
 * The platform launched front-of-house only, so `Role.WAITER` is the only worker
 * role and it is carried in the JWT. Adding `Role.COOK` would fragment waiter
 * search, the passport, trust scoring and every `withRole("WAITER")` guard, and
 * would force every existing user to re-login. So a cook registers as `WAITER`
 * and is distinguished here, by position and department, on `VenueStaff`.
 *
 * `VenueStaff.department` is stored (denormalized) so per-department queries stay
 * indexable, but it is always derived through `departmentOf()` on write — a
 * FOH + HEAD_CHEF row must be impossible.
 *
 * Positions are ordered seniority-first within each department so pickers surface
 * the roles an owner assigns most deliberately before the entry-level ones.
 */
import type { StaffDepartment, StaffPosition, VenueType } from "@prisma/client";
import { BOH_POSITIONS, FOH_POSITIONS } from "@ekonobar/shared/enums";

// ─── Position → department ────────────────────────────────────────────────────

export const POSITION_DEPARTMENT: Record<StaffPosition, StaffDepartment> = {
  // FOH — Sala
  HEAD_WAITER:   "FOH",
  SENIOR_WAITER: "FOH",
  WAITER:        "FOH",
  BARTENDER:     "FOH",
  BARISTA:       "FOH",
  SOMMELIER:     "FOH",
  HOST:          "FOH",
  RUNNER:        "FOH",

  // BOH — Kuhinja
  HEAD_CHEF:   "BOH",
  SOUS_CHEF:   "BOH",
  LINE_COOK:   "BOH",
  GRILL_COOK:  "BOH",
  PASTRY_CHEF: "BOH",
  PREP_COOK:   "BOH",
  DISHWASHER:  "BOH",
};

export function departmentOf(position: StaffPosition): StaffDepartment {
  return POSITION_DEPARTMENT[position];
}

/** Positions belonging to a department, in picker order. */
// Declared in @ekonobar/shared so the mobile Ekipa picker renders the same
// order; re-exported here because every existing caller imports from this file.
export { FOH_POSITIONS, BOH_POSITIONS } from "@ekonobar/shared/enums";

export function positionsForDepartment(department: StaffDepartment): readonly StaffPosition[] {
  return department === "BOH" ? BOH_POSITIONS : FOH_POSITIONS;
}

// ─── Kitchen gating ───────────────────────────────────────────────────────────

/**
 * Venue types that have a kitchen by default. `EVENT` is excluded — an events
 * space books catering rather than staffing a line.
 */
export const KITCHEN_VENUE_TYPES: VenueType[] = ["RESTAURANT", "HOTEL", "CATERING"];

/**
 * Whether a venue staffs a kitchen.
 *
 * `kitchenEnabled` is a nullable override: null means "derive from venueType",
 * an explicit boolean wins. That covers the bar that started serving food and
 * the restaurant that outsources its kitchen without a schema change.
 *
 * When this is false the kitchen surface must be **absent**, not disabled — no
 * department tabs, no BOH positions in pickers, no Kuhinja column in the leave
 * calendar. A café owner should not see a feature that cannot apply to them.
 */
export function hasKitchen(venue: {
  venueType: VenueType;
  kitchenEnabled?: boolean | null;
}): boolean {
  return venue.kitchenEnabled ?? KITCHEN_VENUE_TYPES.includes(venue.venueType);
}

/** Departments a venue actually staffs. Always includes FOH. */
export function departmentsForVenue(venue: {
  venueType: VenueType;
  kitchenEnabled?: boolean | null;
}): StaffDepartment[] {
  return hasKitchen(venue) ? ["FOH", "BOH"] : ["FOH"];
}

/** Guard for writes: reject a BOH position at a venue with no kitchen. */
export function isPositionAllowedAtVenue(
  position: StaffPosition,
  venue: { venueType: VenueType; kitchenEnabled?: boolean | null },
): boolean {
  return departmentsForVenue(venue).includes(departmentOf(position));
}

// ─── Head-of-department ───────────────────────────────────────────────────────

/**
 * Positions that lead a department. Assigning one of these is what should drive
 * `Venue.headWaiterId` / `Venue.headChefId`, so management rights and the roster
 * cannot drift apart.
 */
export const HEAD_POSITIONS: Record<StaffDepartment, StaffPosition> = {
  FOH: "HEAD_WAITER",
  BOH: "HEAD_CHEF",
};

export function isHeadPosition(position: StaffPosition): boolean {
  return position === "HEAD_WAITER" || position === "HEAD_CHEF";
}
