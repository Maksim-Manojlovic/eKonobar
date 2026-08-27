/**
 * Roster helpers shared by the staff routes.
 *
 * Route modules may only export HTTP handlers, so anything both `staff/route.ts`
 * and `staff/[staffId]/route.ts` need lives here.
 */
import { z } from "zod";
import type { StaffPosition } from "@prisma/client";
import { db } from "@/lib/core/db";
import { FOH_POSITIONS, BOH_POSITIONS } from "./positions";

/**
 * Zod enum derived from the position lists rather than hand-written, so adding a
 * position in positions.ts cannot leave the API silently rejecting it.
 */
export const PositionEnum = z.enum(
  [...FOH_POSITIONS, ...BOH_POSITIONS] as [StaffPosition, ...StaffPosition[]],
);

export const EmploymentTypeEnum = z.enum(["FULL_TIME", "SEASONAL", "WEEKEND", "CELEBRATION"]);

export const STAFF_SELECT = {
  id: true,
  position: true,
  department: true,
  status: true,
  employmentType: true,
  startedAt: true,
  endedAt: true,
  notes: true,
  waiter: {
    select: {
      id: true,
      name: true,
      image: true,
      verificationTier: true,
      waiterPassport: { select: { score: true, sanitaryBookValid: true } },
    },
  },
} as const;

export const VENUE_AUTH_SELECT = {
  id: true, ownerId: true, headWaiterId: true, headChefId: true,
  venueType: true, kitchenEnabled: true,
} as const;

/**
 * The person currently holding a head position at this venue, or null.
 *
 * One head per department is enforced so `Venue.headWaiterId` / `headChefId`
 * (which grant real management rights) can never disagree with the roster.
 * Reassigning is a deliberate two-step — demote the incumbent, then promote —
 * rather than a silent write to somebody else's record.
 */
export async function findDepartmentHead(
  venueId: string,
  position: StaffPosition,
  excludeStaffId?: string,
) {
  return db.venueStaff.findFirst({
    where: {
      venueId,
      position,
      status: { not: "ENDED" },
      ...(excludeStaffId && { id: { not: excludeStaffId } }),
    },
    select: { id: true, waiter: { select: { name: true } } },
  });
}
