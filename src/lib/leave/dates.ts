/**
 * Date-only helpers for leave.
 *
 * Leave deals in calendar days, not instants. A "day off" is the same day for
 * everyone regardless of clock time, so every date here is anchored to UTC
 * midnight and every API boundary speaks "YYYY-MM-DD" strings.
 *
 * The trap this avoids: `new Date("2026-07-15")` already parses as UTC midnight,
 * but `new Date(2026, 6, 15)` parses as *local* midnight, and the two differ by
 * the timezone offset. Mixing them makes a range quietly gain or lose a day at
 * the boundary. Construct dates only through `parseDateOnly` and read them back
 * only through `formatDateOnly`, both of which stay in UTC.
 *
 * Prisma `@db.Date` columns round-trip as UTC-midnight Dates, so they compare
 * and format correctly against these without further conversion.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse "YYYY-MM-DD" into a UTC-midnight Date, or null when malformed.
 *
 * Rejects out-of-range component values that `Date` would silently roll over
 * (e.g. "2026-02-31" becoming 3 March), because a request for a date that does
 * not exist is a client bug, not a request for the day after.
 */
export function parseDateOnly(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Round-trip check catches rollover: "2026-02-31" parses, but formats back
  // as "2026-03-03", so it is not the date that was asked for.
  return formatDateOnly(d) === value ? d : null;
}

/** Format a Date as "YYYY-MM-DD" in UTC. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add whole days to a date-only value, staying in UTC. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole days between two date-only values. Same date → 0. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Saturday or Sunday, evaluated in UTC. */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Every date in an inclusive range, as "YYYY-MM-DD".
 * Returns [] when `to` precedes `from`, so callers cannot loop forever.
 */
export function eachDateInRange(from: Date, to: Date): string[] {
  if (to < from) return [];
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(formatDateOnly(d));
  return out;
}

/**
 * How many days a request consumes from the balance.
 *
 * Inclusive of both ends: a single-day request counts 1, not 0. When
 * `countWeekends` is false, Saturdays and Sundays are free — off by default
 * because hospitality staff work weekends, and skipping them would make a
 * 26-day entitlement mean something closer to 36.
 */
export function countLeaveDays(from: Date, to: Date, countWeekends = true): number {
  if (to < from) return 0;
  if (countWeekends) return daysBetween(from, to) + 1;

  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isWeekend(d)) count++;
  }
  return count;
}

/** Whether two inclusive date ranges share at least one day. */
export function rangesOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Split a range that crosses a New Year into per-year segments.
 *
 * Leave is deducted from the balance of the year it falls in, so a request from
 * 28 Dec to 4 Jan is two requests, not one — otherwise eight days would come out
 * of whichever year happened to be looked up first.
 */
export function splitByLeaveYear(from: Date, to: Date): { year: number; from: Date; to: Date }[] {
  if (to < from) return [];

  const segments: { year: number; from: Date; to: Date }[] = [];
  let cursor = from;

  while (cursor <= to) {
    const year = cursor.getUTCFullYear();
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const segmentEnd = yearEnd < to ? yearEnd : to;
    segments.push({ year, from: cursor, to: segmentEnd });
    cursor = addDays(segmentEnd, 1);
  }

  return segments;
}
