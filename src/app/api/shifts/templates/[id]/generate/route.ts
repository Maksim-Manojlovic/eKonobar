import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { computeScheduledStart } from "@/lib/shifts/utils";

export const POST = withRole<{ params: Promise<{ id: string }> }>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const { fromDate, toDate } = body; // "YYYY-MM-DD"

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "fromDate and toDate required" }, { status: 400 });
  }

  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { venue: { ownerId: session.user.id } }
    : { venue: { headWaiterId: session.user.id } };

  const template = await db.shiftTemplate.findFirst({
    where: { id, ...venueFilter },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = new Date(fromDate);
  const to   = new Date(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (diffDays > 90) {
    return NextResponse.json({ error: "Range max 90 days" }, { status: 400 });
  }

  // Find dates matching: weekdays Mon-Fri (1-5) when weekdaysOnly, else specific dayOfWeek
  const matchingDates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const dow = cursor.getDay();
    const matches = template.weekdaysOnly
      ? dow >= 1 && dow <= 5
      : dow === template.dayOfWeek;
    if (matches) matchingDates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (matchingDates.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  // Skip dates where a shift from this template already exists
  const existing = await db.shift.findMany({
    where: {
      templateId: template.id,
      date: { in: matchingDates.map(d => new Date(d)) },
    },
    select: { date: true },
  });
  const existingSet = new Set(existing.map(s => s.date.toISOString().slice(0, 10)));

  const toCreate = matchingDates.filter(d => !existingSet.has(d));

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, skipped: matchingDates.length });
  }

  await db.shift.createMany({
    data: toCreate.map(dateStr => ({
      venueId:        template.venueId,
      templateId:     template.id,
      title:          template.name,
      date:           new Date(dateStr),
      startTime:      template.startTime,
      endTime:        template.endTime,
      scheduledStart: computeScheduledStart(dateStr, template.startTime),
      role:           template.role ?? undefined,
      requiredCount:  template.requiredCount,
      pay:            template.pay ?? undefined,
      status:         "OPEN",
    })),
  });

  return NextResponse.json({ created: toCreate.length, skipped: matchingDates.length - toCreate.length });
});
