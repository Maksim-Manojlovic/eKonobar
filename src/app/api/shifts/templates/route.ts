import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const TemplateCreateSchema = z.object({
  venueId:       z.string().min(1),
  name:          z.string().min(1),
  dayOfWeek:     z.number().int().min(0).max(6).optional(),
  weekdaysOnly:  z.boolean().optional(),
  metadata:      z.unknown().optional(),
  startTime:     z.string().min(1),
  endTime:       z.string().min(1),
  requiredCount: z.number().int().positive().optional(),
  role:          z.string().nullish(),
  pay:           z.number().min(0).nullish(),
});

export const GET = withRole(["VENUE_OWNER", "WAITER"], async (_req, _ctx, session) => {
  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { venue: { ownerId: session.user.id } }
    : { venue: { headWaiterId: session.user.id } };

  const templates = await db.shiftTemplate.findMany({
    where: venueFilter,
    include: { venue: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(templates);
});

export const POST = withRole(["VENUE_OWNER", "WAITER"], async (req, _ctx, session) => {
  const parsed = await parseBody(TemplateCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, name, dayOfWeek, weekdaysOnly, metadata, startTime, endTime, requiredCount, role, pay } = parsed.data;

  if (!weekdaysOnly && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
    return NextResponse.json({ error: "dayOfWeek must be 0–6 when weekdaysOnly is false" }, { status: 400 });
  }

  const venueFilter = session.user.role === "VENUE_OWNER"
    ? { id: venueId, ownerId: session.user.id }
    : { id: venueId, headWaiterId: session.user.id };

  const venue = await db.venue.findFirst({ where: venueFilter });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const template = await db.shiftTemplate.create({
    data: {
      venueId,
      name,
      dayOfWeek: weekdaysOnly ? null : (dayOfWeek ?? null),
      weekdaysOnly: weekdaysOnly ?? false,
      metadata: metadata ?? undefined,
      startTime,
      endTime,
      requiredCount: requiredCount ? Math.max(1, requiredCount) : 1,
      role: role || undefined,
      pay: pay != null ? Math.round(pay) : undefined,
    },
  });

  return NextResponse.json(template, { status: 201 });
});
