/**
 * Leave access resolution.
 *
 * Three tiers, because leave has genuinely different audiences:
 *
 *   owner            → configure policy, block days, in every department
 *   head of dept     → block days in their own department, read the policy
 *   active staff     → read only, their own department (needed to see which
 *                      days are already blocked before requesting leave)
 *
 * Everything else gets no access at all. Resolved in one query so routes do not
 * repeat the membership lookup.
 */
import type { StaffDepartment } from "@prisma/client";
import { db } from "@/lib/core/db";
import { hasKitchen, departmentsForVenue } from "@/lib/staff/positions";

export type LeaveAccess = {
  venueId: string;
  hasKitchen: boolean;
  /** Departments this user may see. Owners get all of the venue's. */
  departments: StaffDepartment[];
  /** Owner only. */
  canManagePolicy: boolean;
  /** Owner, or a head within their own department. */
  canManageBlackouts: boolean;
};

/**
 * Resolve what a user may do with a venue's leave configuration.
 * Returns null when the venue does not exist or the user has no relationship
 * with it — routes turn that into 404 / 403 respectively via `venueExists`.
 */
export async function getLeaveAccess(
  venueId: string,
  userId: string,
  role: string,
): Promise<{ venueExists: boolean; access: LeaveAccess | null }> {
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true, ownerId: true, headWaiterId: true, headChefId: true,
      venueType: true, kitchenEnabled: true,
    },
  });
  if (!venue) return { venueExists: false, access: null };

  const kitchen = hasKitchen(venue);
  const allDepartments = departmentsForVenue(venue);

  if (role === "VENUE_OWNER" && venue.ownerId === userId) {
    return {
      venueExists: true,
      access: {
        venueId, hasKitchen: kitchen, departments: allDepartments,
        canManagePolicy: true, canManageBlackouts: true,
      },
    };
  }

  if (role === "WAITER") {
    // A head leads exactly one department and manages only that one.
    if (venue.headChefId === userId && kitchen) {
      return {
        venueExists: true,
        access: {
          venueId, hasKitchen: kitchen, departments: ["BOH"],
          canManagePolicy: false, canManageBlackouts: true,
        },
      };
    }
    if (venue.headWaiterId === userId) {
      return {
        venueExists: true,
        access: {
          venueId, hasKitchen: kitchen, departments: ["FOH"],
          canManagePolicy: false, canManageBlackouts: true,
        },
      };
    }

    // Rank-and-file staff: read-only, and only their own department.
    const membership = await db.venueStaff.findUnique({
      where: { venueId_waiterId: { venueId, waiterId: userId } },
      select: { department: true, status: true },
    });
    if (membership && membership.status !== "ENDED") {
      return {
        venueExists: true,
        access: {
          venueId, hasKitchen: kitchen, departments: [membership.department],
          canManagePolicy: false, canManageBlackouts: false,
        },
      };
    }
  }

  return { venueExists: true, access: null };
}

/** Whether a resolved access grant covers a specific department. */
export function coversDepartment(access: LeaveAccess, department: StaffDepartment): boolean {
  return access.departments.includes(department);
}
