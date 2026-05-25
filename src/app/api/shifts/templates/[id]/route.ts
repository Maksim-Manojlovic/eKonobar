import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { getManagedTemplate } from "@/lib/shifts/auth";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedTemplate(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, dayOfWeek, weekdaysOnly, metadata, startTime, endTime, requiredCount, role, pay } = body;

  const template = await db.shiftTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(weekdaysOnly !== undefined && { weekdaysOnly: Boolean(weekdaysOnly) }),
      ...(dayOfWeek !== undefined && { dayOfWeek: dayOfWeek === null ? null : Number(dayOfWeek) }),
      ...(metadata !== undefined && { metadata: metadata ?? null }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(requiredCount !== undefined && { requiredCount: Math.max(1, Number(requiredCount)) }),
      role: role !== undefined ? (role || null) : undefined,
      pay: pay !== undefined ? (pay ? Math.round(Number(pay)) : null) : undefined,
    },
  });

  return NextResponse.json(template);
});

export const DELETE = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedTemplate(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
