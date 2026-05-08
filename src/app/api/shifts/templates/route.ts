import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { venue: { ownerId: session.user.id } }
    : { venue: { headWaiterId: session.user.id } };

  const templates = await db.shiftTemplate.findMany({
    where: venueFilter,
    include: { venue: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { venueId, name, dayOfWeek, weekdaysOnly, metadata, startTime, endTime, requiredCount, role, pay } = body;

  if (!venueId || !name || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!weekdaysOnly && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
    return NextResponse.json({ error: "dayOfWeek must be 0–6 when weekdaysOnly is false" }, { status: 400 });
  }

  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { id: venueId, ownerId: session.user.id }
    : { id: venueId, headWaiterId: session.user.id };

  const venue = await db.venue.findFirst({ where: venueFilter });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const template = await db.shiftTemplate.create({
    data: {
      venueId,
      name,
      dayOfWeek: weekdaysOnly ? null : Number(dayOfWeek),
      weekdaysOnly: Boolean(weekdaysOnly),
      metadata: metadata ?? undefined,
      startTime,
      endTime,
      requiredCount: requiredCount ? Math.max(1, Number(requiredCount)) : 1,
      role: role || undefined,
      pay: pay ? Math.round(Number(pay)) : undefined,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
