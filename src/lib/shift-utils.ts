/* ── Time helpers ────────────────────────────────────────────────────────── */

/**
 * Converts an "HH:MM" time string to total minutes from midnight.
 * Used for shift-overlap detection and template validation.
 */
export function shiftTimeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Minimal shape required by shiftsOverlap — satisfied by ShiftTemplate. */
export type ShiftTimeRange = {
  startTime:   string;
  endTime:     string;
  dayOfWeek:   number | null;
  weekdaysOnly: boolean;
};

/**
 * Returns true when two shift templates have overlapping time windows
 * on days they could both be scheduled.
 * Handles overnight shifts (endTime < startTime → wraps past midnight).
 */
export function shiftsOverlap(a: ShiftTimeRange, b: ShiftTimeRange): boolean {
  const aS = shiftTimeToMins(a.startTime);
  let   aE = shiftTimeToMins(a.endTime);
  const bS = shiftTimeToMins(b.startTime);
  let   bE = shiftTimeToMins(b.endTime);
  if (aE <= aS) aE += 1440; // overnight
  if (bE <= bS) bE += 1440;
  const sameDay = a.weekdaysOnly || b.weekdaysOnly || a.dayOfWeek === b.dayOfWeek;
  return sameDay && aS < bE && bS < aE;
}

/* ── DateTime computation ────────────────────────────────────────────────── */

/**
 * Compute scheduledStart DateTime from a date string ("YYYY-MM-DD") and time ("HH:MM").
 * endTime before startTime (e.g. "02:00" < "18:00") means end is next calendar day.
 */
export function computeScheduledStart(dateStr: string, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const base = new Date(dateStr); // midnight UTC of that date
  base.setUTCHours(h, m, 0, 0);
  return base;
}

export function computeScheduledEnd(dateStr: string, startTime: string, endTime: string): Date {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const base = new Date(dateStr);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const dayOffset = endMinutes < startMinutes ? 1 : 0;
  base.setUTCHours(eh, em, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return base;
}
