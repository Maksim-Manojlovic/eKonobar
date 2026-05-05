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
