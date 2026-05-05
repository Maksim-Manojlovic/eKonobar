import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScheduledStart } from "@/lib/shift-utils";

const ASSIGNMENT_SELECT = {
  id: true,
  waiterId: true,
  clockInAt: true,
  clockOutAt: true,
  clockInMethod: true,
  lateMinutes: true,
  earlyExitAt: true,
  waiter: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // "open" | "swaps" | null (mine)

    if (session.user.role === "VENUE_OWNER") {
      const shifts = await db.shift.findMany({
        where: { venue: { ownerId: session.user.id } },
        include: {
          assignments: { include: { waiter: { select: { id: true, name: true } } } },
          swapRequests: {
            where: { status: "PENDING" },
            include: {
              fromAssignment: { include: { waiter: { select: { id: true, name: true } } } },
              toWaiter: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
      return NextResponse.json(shifts);
    }

    if (session.user.role === "WAITER") {
      if (view === "open") {
        const shifts = await db.shift.findMany({
          where: { status: "OPEN" },
          include: {
            venue: { select: { id: true, name: true, address: true, municipality: true } },
            assignments: { select: { waiterId: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 50,
        });
        return NextResponse.json(shifts);
      }

      if (view === "swaps") {
        const swaps = await db.shiftSwapRequest.findMany({
          where: { toWaiterId: session.user.id, status: "PENDING" },
          include: {
            shift: {
              include: {
                venue: { select: { id: true, name: true, address: true, municipality: true } },
              },
            },
            fromAssignment: { include: { waiter: { select: { id: true, name: true } } } },
          },
          orderBy: { requestedAt: "desc" },
        });
        return NextResponse.json(swaps);
      }

      // default: my assigned shifts
      const shifts = await db.shift.findMany({
        where: { assignments: { some: { waiterId: session.user.id } } },
        include: {
          venue: { select: { id: true, name: true, address: true, municipality: true } },
          assignments: {
            where: { waiterId: session.user.id },
            select: ASSIGNMENT_SELECT,
          },
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
  const {
    venueId, title, date, startTime, endTime,
    role, pay, waiterIds, notes,
    requiredCount, tipEstimate, briefingNote, swapLocked,
  } = body;

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

  const rc = requiredCount ? Math.max(1, Number(requiredCount)) : 1;
  const scheduledStart = computeScheduledStart(date, startTime);
  const status = ids.length >= rc ? "ASSIGNED" : ids.length > 0 ? "ASSIGNED" : "OPEN";

  try {
    const shift = await db.shift.create({
      data: {
        venueId,
        title,
        date: new Date(date),
        startTime,
        endTime,
        scheduledStart,
        role: role || undefined,
        requiredCount: rc,
        tipEstimate: tipEstimate ? Number(tipEstimate) : undefined,
        pay: pay ? Math.round(Number(pay)) : undefined,
        briefingNote: briefingNote || undefined,
        notes: notes || undefined,
        swapLocked: Boolean(swapLocked),
        status,
        assignments: ids.length
          ? { create: ids.map((waiterId: string) => ({ waiterId })) }
          : undefined,
      },
      include: {
        assignments: { include: { waiter: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("[POST /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
