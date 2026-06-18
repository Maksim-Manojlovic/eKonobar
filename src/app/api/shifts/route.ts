import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { computeScheduledStart } from "@/lib/shifts/utils";
import type { Session } from "next-auth";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ShiftCreateSchema = z.object({
  venueId:       z.string().min(1),
  title:         z.string().min(1),
  date:          z.string().min(1),
  startTime:     z.string().min(1),
  endTime:       z.string().min(1),
  role:          z.string().nullish(),
  pay:           z.number().min(0).nullish(),
  waiterIds:     z.array(z.string()).optional(),
  notes:         z.string().nullish(),
  requiredCount: z.number().int().positive().optional(),
  tipEstimate:   z.number().min(0).nullish(),
  briefingNote:  z.string().nullish(),
  swapLocked:    z.boolean().optional(),
});

const ASSIGNMENT_SELECT = {
  id: true,
  waiterId: true,
  clockInAt: true,
  clockOutAt: true,
  clockInMethod: true,
  lateMinutes: true,
  earlyExitAt: true,
  pendingClockIn: true,
  waiter: { select: { id: true, name: true } },
};

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (req, _ctx, session) => {
  if (session.user.role === "VENUE_OWNER") return getOwnerShifts(req, session);
  if (session.user.role === "WAITER")      return getWaiterShifts(req, session);
  return NextResponse.json([]);
});

async function getOwnerShifts(req: NextRequest, session: Session) {
  const { searchParams } = new URL(req.url);
  const fromParam   = searchParams.get("from");
  const toParam     = searchParams.get("to");
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const shifts = await db.shift.findMany({
    where: {
      venue: { ownerId: session.user.id },
      date: {
        gte: fromParam ? new Date(fromParam) : defaultFrom,
        ...(toParam && { lte: new Date(toParam) }),
      },
    },
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

async function getWaiterShifts(req: NextRequest, session: Session) {
  const view = new URL(req.url).searchParams.get("view"); // "manage" | "open" | "swaps" | null

  if (view === "manage") {
    const managedVenue = await db.venue.findFirst({
      where: { headWaiterId: session.user.id },
      select: { id: true, name: true },
    });
    // A waiter who manages no venue isn't "forbidden" — they just manage nothing.
    // Return an empty 200 so the dashboard doesn't fire a 403 on every load (CQ-L).
    if (!managedVenue) return NextResponse.json({ venue: null, shifts: [] });

    const shifts = await db.shift.findMany({
      where: { venueId: managedVenue.id },
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
    return NextResponse.json({ venue: managedVenue, shifts });
  }

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

// ── POST ──────────────────────────────────────────────────────────────────────

export const POST = withRole(["VENUE_OWNER", "WAITER"], async (req, _ctx, session) => {
  const parsed = await parseBody(ShiftCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const {
    venueId, title, date, startTime, endTime,
    role, pay, waiterIds, notes,
    requiredCount, tipEstimate, briefingNote, swapLocked,
  } = parsed.data;

  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { id: venueId, ownerId: session.user.id }
    : { id: venueId, headWaiterId: session.user.id };

  const venue = await db.venue.findFirst({ where: venueFilter });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const ids: string[] = Array.isArray(waiterIds) ? waiterIds : [];
  if (ids.length) {
    const found = await db.user.findMany({ where: { id: { in: ids }, role: "WAITER" } });
    if (found.length !== ids.length) {
      return NextResponse.json({ error: "One or more waiters not found" }, { status: 404 });
    }
  }

  const rc = requiredCount ? Math.max(1, requiredCount) : 1;
  const scheduledStart = computeScheduledStart(date, startTime);
  const status = ids.length >= rc ? "ASSIGNED" : "OPEN";

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
      tipEstimate: tipEstimate ?? undefined,
      pay: pay != null ? Math.round(pay) : undefined,
      briefingNote: briefingNote || undefined,
      notes: notes || undefined,
      swapLocked: swapLocked ?? false,
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
});
