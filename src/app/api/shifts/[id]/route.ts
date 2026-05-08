import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScheduledStart } from "@/lib/shift-utils";
import { getManagedShift } from "@/lib/shift-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getManagedShift(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    title, date, startTime, endTime, role, pay, waiterIds, notes,
    requiredCount, tipEstimate, briefingNote, swapLocked, status,
  } = body;

  const ids: string[] = waiterIds !== undefined
    ? (Array.isArray(waiterIds) ? waiterIds : [])
    : [];

  if (waiterIds !== undefined && ids.length) {
    const found = await db.user.findMany({ where: { id: { in: ids }, role: "WAITER" } });
    if (found.length !== ids.length) {
      return NextResponse.json({ error: "One or more waiters not found" }, { status: 404 });
    }
  }

  try {
    const newDate = date !== undefined ? date : existing.date.toISOString().slice(0, 10);
    const newStart = startTime !== undefined ? startTime : existing.startTime;
    const scheduledStart = (date !== undefined || startTime !== undefined)
      ? computeScheduledStart(newDate, newStart)
      : undefined;

    // Derive status when waiter assignments change
    let newStatus = status;
    if (waiterIds !== undefined && !status) {
      const rc = requiredCount ?? existing.requiredCount;
      newStatus = ids.length > 0 ? "ASSIGNED" : "OPEN";
      void rc;
    }

    const shift = await db.shift.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(scheduledStart && { scheduledStart }),
        role: role !== undefined ? (role || null) : undefined,
        pay: pay !== undefined ? (pay ? Math.round(Number(pay)) : null) : undefined,
        ...(requiredCount !== undefined && { requiredCount: Math.max(1, Number(requiredCount)) }),
        tipEstimate: tipEstimate !== undefined ? (tipEstimate ? Number(tipEstimate) : null) : undefined,
        briefingNote: briefingNote !== undefined ? (briefingNote || null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        ...(swapLocked !== undefined && { swapLocked: Boolean(swapLocked) }),
        ...(newStatus && { status: newStatus }),
        ...(waiterIds !== undefined && {
          assignments: {
            deleteMany: {},
            create: ids.map((waiterId: string) => ({ waiterId })),
          },
        }),
      },
      include: {
        assignments: { include: { waiter: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json(shift);
  } catch (err) {
    console.error("[PATCH /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getManagedShift(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await db.shift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
