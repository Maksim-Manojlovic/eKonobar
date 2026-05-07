import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await db.shiftTemplate.findMany({
    where: { venue: { ownerId: session.user.id } },
    include: { venue: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { venueId, name, dayOfWeek, startTime, endTime, requiredCount, role, pay } = body;

  if (!venueId || !name || dayOfWeek === undefined || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "dayOfWeek must be 0–6" }, { status: 400 });
  }

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const template = await db.shiftTemplate.create({
    data: {
      venueId,
      name,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      requiredCount: requiredCount ? Math.max(1, Number(requiredCount)) : 1,
      role: role || undefined,
      pay: pay ? Math.round(Number(pay)) : undefined,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
