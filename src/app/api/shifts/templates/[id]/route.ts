import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { getManagedTemplate } from "@/lib/shifts/auth";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const TemplatePatchSchema = z.object({
  name:          z.string().optional(),
  dayOfWeek:     z.number().int().min(0).max(6).nullish(),
  weekdaysOnly:  z.boolean().optional(),
  metadata:      z.unknown().optional(),
  startTime:     z.string().optional(),
  endTime:       z.string().optional(),
  requiredCount: z.number().int().positive().optional(),
  role:          z.string().nullish(),
  pay:           z.number().nullish(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withRole<Ctx>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await getManagedTemplate(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseBody(TemplatePatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, dayOfWeek, weekdaysOnly, metadata, startTime, endTime, requiredCount, role, pay } = parsed.data;

  const template = await db.shiftTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(weekdaysOnly !== undefined && { weekdaysOnly }),
      ...(dayOfWeek !== undefined && { dayOfWeek: dayOfWeek ?? null }),
      ...(metadata !== undefined && { metadata: metadata != null ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(requiredCount !== undefined && { requiredCount: Math.max(1, requiredCount) }),
      role: role !== undefined ? (role || null) : undefined,
      pay: pay !== undefined ? (pay != null ? Math.round(pay) : null) : undefined,
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
