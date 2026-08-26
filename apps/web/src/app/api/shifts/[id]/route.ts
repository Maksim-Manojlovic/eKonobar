import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { computeScheduledStart } from "@/lib/shifts/utils";
import { getManagedShift } from "@/lib/shifts/auth";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";
import { ShiftStatus } from "@prisma/client";

const ShiftPatchSchema = z.object({
  title:         z.string().optional(),
  date:          z.string().optional(),
  startTime:     z.string().optional(),
  endTime:       z.string().optional(),
  role:          z.string().nullish(),
  pay:           z.number().nullish(),
  waiterIds:     z.array(z.string()).optional(),
  notes:         z.string().nullish(),
  requiredCount: z.number().int().positive().optional(),
  tipEstimate:   z.number().nullish(),
  briefingNote:  z.string().nullish(),
  swapLocked:    z.boolean().optional(),
  status:        z.nativeEnum(ShiftStatus).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedShift(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseBody(ShiftPatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const {
    title, date, startTime, endTime, role, pay, waiterIds, notes,
    requiredCount, tipEstimate, briefingNote, swapLocked, status,
  } = parsed.data;

  const ids: string[] = waiterIds !== undefined
    ? (Array.isArray(waiterIds) ? waiterIds : [])
    : [];

  if (waiterIds !== undefined && ids.length) {
    const found = await db.user.findMany({ where: { id: { in: ids }, role: "WAITER" } });
    if (found.length !== ids.length) {
      return NextResponse.json({ error: "One or more waiters not found" }, { status: 404 });
    }
  }

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
      pay: pay !== undefined ? (pay != null ? Math.round(pay) : null) : undefined,
      ...(requiredCount !== undefined && { requiredCount: Math.max(1, requiredCount) }),
      tipEstimate: tipEstimate !== undefined ? (tipEstimate ?? null) : undefined,
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
});

export const DELETE = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedShift(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
