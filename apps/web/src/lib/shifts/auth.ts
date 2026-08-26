import type { StaffDepartment } from "@prisma/client";
import { db } from "@/lib/core/db";

type VenueAuthInfo = {
  ownerId: string;
  headWaiterId: string | null;
  /** Optional so existing callers that select only the two original fields keep compiling. */
  headChefId?: string | null;
};

/**
 * Shifts created before departments existed have `department: null`. Every one
 * of them is front-of-house — the platform had no kitchen staff until then — so
 * a null reads as FOH rather than as "unscoped".
 */
export function departmentOfShift(shift: { department: StaffDepartment | null }): StaffDepartment {
  return shift.department ?? "FOH";
}

/**
 * Whether the user may manage shifts at this venue *at all*.
 *
 * Deliberately unscoped: list views and creation flows need to know "can this
 * person touch the schedule here" before any specific shift exists. Use
 * `canManageDepartment` when acting on a shift that belongs to one.
 */
export function canManageShifts(userId: string, role: string, venue: VenueAuthInfo): boolean {
  if (role === "VENUE_OWNER" && venue.ownerId === userId) return true;
  if (role !== "WAITER") return false;
  return venue.headWaiterId === userId || venue.headChefId === userId;
}

/**
 * Whether the user may manage shifts in a specific department.
 *
 * The owner manages both. A head waiter manages the floor and a head chef the
 * kitchen — without this split, appointing a head chef would hand them the
 * floor rota too, and vice versa.
 */
export function canManageDepartment(
  userId: string,
  role: string,
  venue: VenueAuthInfo,
  department: StaffDepartment,
): boolean {
  if (role === "VENUE_OWNER" && venue.ownerId === userId) return true;
  if (role !== "WAITER") return false;
  return department === "BOH"
    ? venue.headChefId === userId
    : venue.headWaiterId === userId;
}

const VENUE_AUTH_SELECT = {
  id: true, ownerId: true, headWaiterId: true, headChefId: true,
} as const;

/**
 * A shift the user may manage, or null when it does not exist or is out of
 * their department.
 */
export async function getManagedShift(shiftId: string, userId: string, role: string) {
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: {
      venue: { select: VENUE_AUTH_SELECT },
      assignments: { select: { waiterId: true } },
    },
  });
  if (!shift) return null;
  if (!canManageDepartment(userId, role, shift.venue, departmentOfShift(shift))) return null;
  return shift;
}

export async function getManagedTemplate(templateId: string, userId: string, role: string) {
  const template = await db.shiftTemplate.findUnique({
    where: { id: templateId },
    include: { venue: { select: VENUE_AUTH_SELECT } },
  });
  if (!template) return null;
  // Templates carry no department yet, so they stay at venue-level authority.
  if (!canManageShifts(userId, role, template.venue)) return null;
  return template;
}
