import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role === "VENUE_OWNER") {
      const shifts = await db.shift.findMany({
        where: { venue: { ownerId: session.user.id } },
        include: { waiter: { select: { id: true, name: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
      return NextResponse.json(shifts);
    }

    if (session.user.role === "WAITER") {
      const shifts = await db.shift.findMany({
        where: { waiterId: session.user.id },
        include: {
          venue: { select: { id: true, name: true, address: true, municipality: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
      return NextResponse.json(shifts);
    }

    return NextResponse.json([]);
  } catch (err) {
    console.error("[GET /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { venueId, title, date, startTime, endTime, role, pay, waiterId, notes } = body;

  if (!venueId || !title || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  if (waiterId) {
    const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
    if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });
  }

  try {
    const shift = await db.shift.create({
      data: {
        venueId,
        waiterId: waiterId || undefined,
        title,
        date: new Date(date),
        startTime,
        endTime,
        role: role || undefined,
        pay: pay ? Math.round(Number(pay)) : undefined,
        notes: notes || undefined,
      },
      include: { waiter: { select: { id: true, name: true } } },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("[POST /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
