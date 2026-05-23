import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { computeScheduledStart } from "@/lib/shift-utils";
import { getManagedShift } from "@/lib/shift-auth";
import logger from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id } = await ctx.params;
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
      newStatus = ids.length >= rc ? "ASSIGNED" : "OPEN";
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
    logger.error({ err }, "PATCH /api/shifts/[id]");
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
});

export const DELETE = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedShift(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await db.shift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/shifts/[id]");
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
});
