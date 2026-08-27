import { describe, it, expect } from "vitest";
import * as Prisma from "@prisma/client";
import * as Shared from "@ekonobar/shared/enums";

/**
 * Guards the one duplication @ekonobar/shared is allowed to carry.
 *
 * The mobile app cannot import Prisma's runtime enum objects — the generated
 * client drags a Node runtime and native engine binaries Metro cannot bundle —
 * so the values are re-declared as `as const` objects in the shared package.
 * This test is what makes that safe: add a value to schema.prisma and every
 * assertion below fails until the shared copy is updated too.
 *
 * It lives in apps/web rather than packages/shared because this is the only
 * workspace with a Vitest project, and it is the workspace that has Prisma.
 */

const PAIRS: Array<[name: string, prisma: Record<string, string>, shared: Record<string, string>]> = [
  ["Role",              Prisma.Role,              Shared.ROLES],
  ["VerificationTier",  Prisma.VerificationTier,  Shared.VERIFICATION_TIERS],
  ["VenueType",         Prisma.VenueType,         Shared.VENUE_TYPES],
  ["EngagementType",    Prisma.EngagementType,    Shared.ENGAGEMENT_TYPES],
  ["TipSystem",         Prisma.TipSystem,         Shared.TIP_SYSTEMS],
  ["JobPostStatus",     Prisma.JobPostStatus,     Shared.JOB_POST_STATUSES],
  ["ApplicationStatus", Prisma.ApplicationStatus, Shared.APPLICATION_STATUSES],
  ["ReviewDirection",   Prisma.ReviewDirection,   Shared.REVIEW_DIRECTIONS],
  ["ReviewStatus",      Prisma.ReviewStatus,      Shared.REVIEW_STATUSES],
  ["SanitaryStatus",    Prisma.SanitaryStatus,    Shared.SANITARY_STATUSES],
  ["ShiftStatus",       Prisma.ShiftStatus,       Shared.SHIFT_STATUSES],
  ["ClockInMethod",     Prisma.ClockInMethod,     Shared.CLOCK_IN_METHODS],
  ["SwapRequestStatus", Prisma.SwapRequestStatus, Shared.SWAP_REQUEST_STATUSES],
  ["StaffDepartment",   Prisma.StaffDepartment,   Shared.STAFF_DEPARTMENTS],
  ["StaffPosition",     Prisma.StaffPosition,     Shared.STAFF_POSITIONS],
  ["StaffStatus",       Prisma.StaffStatus,       Shared.STAFF_STATUSES],
  ["LeaveType",         Prisma.LeaveType,         Shared.LEAVE_TYPES],
  ["LeaveStatus",       Prisma.LeaveStatus,       Shared.LEAVE_STATUSES],
  ["NotificationType",  Prisma.NotificationType,  Shared.NOTIFICATION_TYPES],
  ["ZoneType",          Prisma.ZoneType,          Shared.ZONE_TYPES],
  ["InviteType",        Prisma.InviteType,        Shared.INVITE_TYPES],
  ["InviteStatus",      Prisma.InviteStatus,      Shared.INVITE_STATUSES],
];

describe("@ekonobar/shared enums match Prisma exactly", () => {
  it.each(PAIRS)("%s", (_name, prisma, shared) => {
    expect(Object.keys(shared).sort()).toEqual(Object.keys(prisma).sort());
    expect(Object.values(shared).sort()).toEqual(Object.values(prisma).sort());
  });

  it.each(PAIRS)("%s — every key maps to itself", (_name, _prisma, shared) => {
    for (const [key, value] of Object.entries(shared)) {
      expect(value).toBe(key);
    }
  });

  it("covers every enum Prisma exports, so a new enum cannot be forgotten", () => {
    // Prisma's runtime enum objects are the only exports whose every value is a
    // string equal to its own key — that is what distinguishes them from the
    // client classes and helper objects also exported from @prisma/client.
    const prismaEnums = Object.entries(Prisma)
      .filter(([name, value]) =>
        /^[A-Z]/.test(name) &&
        value !== null &&
        typeof value === "object" &&
        Object.keys(value as object).length > 0 &&
        Object.entries(value as Record<string, unknown>).every(([k, v]) => v === k),
      )
      .map(([name]) => name)
      // Prisma's own internal enums, not part of the domain model.
      .filter(name => !["TransactionIsolationLevel", "SortOrder", "QueryMode", "NullsOrder"].includes(name))
      .filter(name => !name.endsWith("ScalarFieldEnum"));

    const covered = PAIRS.map(([name]) => name);
    expect(prismaEnums.filter(n => !covered.includes(n))).toEqual([]);
  });
});
