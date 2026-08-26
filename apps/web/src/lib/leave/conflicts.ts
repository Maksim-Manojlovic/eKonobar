/**
 * Leave ↔ shift conflict lookups.
 *
 * Leave that does not affect scheduling is decoration, so these are the seams
 * where the two systems meet. The asymmetry is deliberate and consistent:
 *
 *   worker-initiated actions (claim, swap target)  → hard block
 *   manager-initiated actions (assign, generate)   → warn, never block
 *
 * A manager may knowingly schedule over someone's approved leave — they might
 * have just agreed it verbally. A worker must not be able to book themselves
 * onto a shift they already have off.
 *
 * Only APPROVED leave blocks. A pending request is not yet a commitment, and
 * treating it as one would let anyone freeze the rota by asking.
 */
import { db } from "@/lib/core/db";

export type LeaveConflict = {
  waiterId: string;
  requestId: string;
  type: string;
  startDate: Date;
  endDate: Date;
};

/**
 * Approved leave covering `date` for any of `waiterIds`.
 * Empty array in, empty array out — no query.
 */
export async function findLeaveOnDate(
  waiterIds: string[],
  date: Date,
): Promise<LeaveConflict[]> {
  if (waiterIds.length === 0) return [];

  const rows = await db.leaveRequest.findMany({
    where: {
      waiterId: { in: waiterIds },
      status: "APPROVED",
      startDate: { lte: date },
      endDate:   { gte: date },
    },
    select: { id: true, waiterId: true, type: true, startDate: true, endDate: true },
  });

  return rows.map(r => ({
    waiterId: r.waiterId, requestId: r.id, type: r.type,
    startDate: r.startDate, endDate: r.endDate,
  }));
}

/** Whether one worker has approved leave covering a date. */
export async function isOnLeave(waiterId: string, date: Date): Promise<boolean> {
  const found = await db.leaveRequest.findFirst({
    where: {
      waiterId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate:   { gte: date },
    },
    select: { id: true },
  });
  return !!found;
}

/**
 * Approved leave overlapping a date window, keyed by the dates it covers.
 * Used by template generation, which decides per generated date.
 */
export async function findLeaveInRange(
  waiterIds: string[],
  from: Date,
  to: Date,
): Promise<LeaveConflict[]> {
  if (waiterIds.length === 0) return [];

  const rows = await db.leaveRequest.findMany({
    where: {
      waiterId: { in: waiterIds },
      status: "APPROVED",
      // Overlap, not containment: leave starting before the window still covers
      // days inside it.
      startDate: { lte: to },
      endDate:   { gte: from },
    },
    select: { id: true, waiterId: true, type: true, startDate: true, endDate: true },
  });

  return rows.map(r => ({
    waiterId: r.waiterId, requestId: r.id, type: r.type,
    startDate: r.startDate, endDate: r.endDate,
  }));
}

/**
 * Shift assignments that clash with a leave request's dates.
 *
 * Surfaced when a manager approves leave, so they can see what they are about
 * to strand. Nothing is unassigned automatically — the manager decides, because
 * silently pulling someone off a rota is how a venue ends up short-staffed
 * without noticing.
 */
export async function findShiftConflicts(waiterId: string, from: Date, to: Date) {
  return db.shiftAssignment.findMany({
    where: {
      waiterId,
      shift: {
        date: { gte: from, lte: to },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
    },
    select: {
      id: true,
      shift: { select: { id: true, title: true, date: true, startTime: true, endTime: true } },
    },
    orderBy: { shift: { date: "asc" } },
  });
}
