import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScheduledStart } from "@/lib/shift-utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { fromDate, toDate } = body; // "YYYY-MM-DD"

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "fromDate and toDate required" }, { status: 400 });
  }

  const template = await db.shiftTemplate.findFirst({
    where: { id, venue: { ownerId: session.user.id } },
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

  // Find dates in range matching template.dayOfWeek (0=Sun, 6=Sat)
  const matchingDates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    if (cursor.getDay() === template.dayOfWeek) {
      matchingDates.push(cursor.toISOString().slice(0, 10));
    }
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
      venueId:       template.venueId,
      templateId:    template.id,
      title:         template.name,
      date:          new Date(dateStr),
      startTime:     template.startTime,
      endTime:       template.endTime,
      scheduledStart: computeScheduledStart(dateStr, template.startTime),
      role:          template.role ?? undefined,
      requiredCount: template.requiredCount,
      pay:           template.pay ?? undefined,
      status:        "OPEN",
    })),
  });

  return NextResponse.json({ created: toCreate.length, skipped: matchingDates.length - toCreate.length });
}
