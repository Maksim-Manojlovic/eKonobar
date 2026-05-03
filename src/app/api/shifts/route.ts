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
        include: { waiters: { select: { id: true, name: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
      return NextResponse.json(shifts);
    }

    if (session.user.role === "WAITER") {
      const shifts = await db.shift.findMany({
        where: { waiters: { some: { id: session.user.id } } },
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
  const { venueId, title, date, startTime, endTime, role, pay, waiterIds, notes } = body;

  if (!venueId || !title || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const ids: string[] = Array.isArray(waiterIds) ? waiterIds : [];
  if (ids.length) {
    const found = await db.user.findMany({ where: { id: { in: ids }, role: "WAITER" } });
    if (found.length !== ids.length) {
      return NextResponse.json({ error: "One or more waiters not found" }, { status: 404 });
    }
  }

  try {
    const shift = await db.shift.create({
      data: {
        venueId,
        title,
        date: new Date(date),
        startTime,
        endTime,
        role: role || undefined,
        pay: pay ? Math.round(Number(pay)) : undefined,
        notes: notes || undefined,
        waiters: ids.length ? { connect: ids.map((id: string) => ({ id })) } : undefined,
      },
      include: { waiters: { select: { id: true, name: true } } },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("[POST /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
