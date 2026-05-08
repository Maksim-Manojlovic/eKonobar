import { db } from "@/lib/db";

type VenueAuthInfo = { ownerId: string; headWaiterId: string | null };

export function canManageShifts(userId: string, role: string, venue: VenueAuthInfo): boolean {
  return (
    (role === "VENUE_OWNER" && venue.ownerId === userId) ||
    (role === "WAITER" && venue.headWaiterId === userId)
  );
}

export async function getManagedShift(shiftId: string, userId: string, role: string) {
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: {
      venue: { select: { id: true, ownerId: true, headWaiterId: true } },
      assignments: { select: { waiterId: true } },
    },
  });
  if (!shift) return null;
  if (!canManageShifts(userId, role, shift.venue)) return null;
  return shift;
}

export async function getManagedTemplate(templateId: string, userId: string, role: string) {
  const template = await db.shiftTemplate.findUnique({
    where: { id: templateId },
    include: { venue: { select: { id: true, ownerId: true, headWaiterId: true } } },
  });
  if (!template) return null;
  if (!canManageShifts(userId, role, template.venue)) return null;
  return template;
}
