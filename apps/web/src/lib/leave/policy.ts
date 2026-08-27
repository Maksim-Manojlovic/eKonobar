/**
 * Leave policy resolution.
 *
 * A venue does not need to configure anything before the feature works: an
 * absent `LeavePolicy` row means the defaults below apply. Rows are only written
 * when an owner changes something, so "never touched it" and "explicitly set it
 * to the default" stay distinguishable, and changing a default later does not
 * silently rewrite every venue.
 */
import type { LeavePolicy, StaffDepartment, VenueBlackoutDate } from "@prisma/client";

/** Field set every caller needs; matches the LeavePolicy columns. */
export type ResolvedPolicy = {
  annualDays:        number;
  maxConcurrentOff:  number;
  minNoticeDays:     number;
  autoApprove:       boolean;
  countWeekends:     boolean;
  allowCarryOver:    boolean;
  carryOverDays:     number;
  carryOverDeadline: string;
};

/**
 * Defaults, kept in sync with the `@default` values in schema.prisma.
 *
 * 26 annual days is a house default above the Serbian statutory minimum of 20
 * working days (Zakon o radu čl. 69) — configurable, never assumed.
 */
export const DEFAULT_POLICY: ResolvedPolicy = {
  annualDays:        26,
  maxConcurrentOff:  2,
  minNoticeDays:     14,
  autoApprove:       true,
  countWeekends:     true,
  allowCarryOver:    true,
  carryOverDays:     5,
  carryOverDeadline: "06-30",
};

/** A stored policy row, or the defaults when the venue has never configured one. */
export function resolvePolicy(row: LeavePolicy | null | undefined): ResolvedPolicy {
  if (!row) return { ...DEFAULT_POLICY };
  return {
    annualDays:        row.annualDays,
    maxConcurrentOff:  row.maxConcurrentOff,
    minNoticeDays:     row.minNoticeDays,
    autoApprove:       row.autoApprove,
    countWeekends:     row.countWeekends,
    allowCarryOver:    row.allowCarryOver,
    carryOverDays:     row.carryOverDays,
    carryOverDeadline: row.carryOverDeadline,
  };
}

/**
 * How many people may be off on a given day.
 *
 * A blackout row overrides the policy default for that date; `maxOff: 0` is the
 * owner's "X" — everyone works. Note this is deliberately not a boolean: a pure
 * on/off block handles "everyone works New Year's Eve" but not "three cooks all
 * want 15 July", which is the far more common conflict.
 */
export function effectiveMaxOff(
  policy: ResolvedPolicy,
  blackout: Pick<VenueBlackoutDate, "maxOff"> | null | undefined,
): number {
  return blackout ? blackout.maxOff : policy.maxConcurrentOff;
}

/** A day nobody may take off. */
export function isFullyBlocked(
  policy: ResolvedPolicy,
  blackout: Pick<VenueBlackoutDate, "maxOff"> | null | undefined,
): boolean {
  return effectiveMaxOff(policy, blackout) <= 0;
}

/**
 * Whether one more person can go off on a day that already has `approvedCount`
 * people off.
 */
export function hasCapacity(
  policy: ResolvedPolicy,
  blackout: Pick<VenueBlackoutDate, "maxOff"> | null | undefined,
  approvedCount: number,
): boolean {
  return approvedCount < effectiveMaxOff(policy, blackout);
}

/**
 * Pro-rated first-year entitlement, following the Serbian 1/12-per-month rule:
 * someone who starts in July earns half a year's leave, not a full one.
 *
 * A start date before the leave year gives the full entitlement; a start date
 * after it gives none.
 */
export function proRatedEntitlement(
  annualDays: number,
  startedAt: Date,
  year: number,
): number {
  const startYear = startedAt.getUTCFullYear();
  if (startYear < year) return annualDays;
  if (startYear > year) return 0;

  // getUTCMonth is 0-based; someone starting in December still earns 1 month.
  const monthsWorked = 12 - startedAt.getUTCMonth();
  return Math.round((annualDays * monthsWorked) / 12);
}

/**
 * Departments a venue needs a policy row for. FOH always; BOH only where there
 * is a kitchen — see hasKitchen() in lib/staff/positions.ts.
 */
export function policyDepartments(hasKitchen: boolean): StaffDepartment[] {
  return hasKitchen ? ["FOH", "BOH"] : ["FOH"];
}
