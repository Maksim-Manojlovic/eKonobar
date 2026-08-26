import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody, parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";
import { departmentOf, isPositionAllowedAtVenue, isHeadPosition, hasKitchen } from "@/lib/staff/positions";
import { canManageRoster, canViewRoster, ledDepartment } from "@/lib/staff/auth";
import {
  PositionEnum, EmploymentTypeEnum, STAFF_SELECT, VENUE_AUTH_SELECT, findDepartmentHead,
} from "@/lib/staff/roster";
import { POSITION_LABELS } from "@/lib/formatting/display-maps";

type Ctx = { params: Promise<{ id: string }> };

const QuerySchema = z.object({
  department:   z.enum(["FOH", "BOH"]).optional(),
  includeEnded: z.enum(["true", "false"]).optional(),
});

const CreateSchema = z.object({
  waiterId:       z.string().min(1),
  position:       PositionEnum,
  employmentType: EmploymentTypeEnum,
  startedAt:      z.string().min(1),
  notes:          z.string().max(1000).nullish(),
});

// ── GET — roster list ─────────────────────────────────────────────────────────

export const GET = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;

  const venue = await db.venue.findUnique({ where: { id }, select: VENUE_AUTH_SELECT });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  if (!canViewRoster(session.user.id, session.user.role, venue)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // A head of department sees only their own department; the owner sees everything.
  const led = ledDepartment(session.user.id, session.user.role, venue);
  const department = led ?? parsed.data.department;

  const staff = await db.venueStaff.findMany({
    where: {
      venueId: id,
      ...(department && { department }),
      ...(parsed.data.includeEnded === "true" ? {} : { status: { not: "ENDED" } }),
    },
    select: STAFF_SELECT,
    orderBy: [{ department: "asc" }, { position: "asc" }, { startedAt: "asc" }],
  });

  return NextResponse.json({
    staff,
    hasKitchen: hasKitchen(venue),
    canManage:  canManageRoster(session.user.id, session.user.role, venue),
  });
});

// ── POST — add someone to the roster ──────────────────────────────────────────

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(CreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { waiterId, position, employmentType, startedAt, notes } = parsed.data;

  const venue = await db.venue.findUnique({ where: { id }, select: VENUE_AUTH_SELECT });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  if (!canManageRoster(session.user.id, session.user.role, venue)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // A kitchen position at a venue with no kitchen would create a BOH row that no
  // UI surface can ever show — reject rather than orphan it.
  if (!isPositionAllowedAtVenue(position, venue)) {
    return NextResponse.json(
      { error: "Ovaj lokal nema kuhinju — kuhinjske pozicije nisu dostupne" },
      { status: 400 },
    );
  }

  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) {
    return NextResponse.json({ error: "Nevažeći datum početka" }, { status: 400 });
  }

  const waiter = await db.user.findUnique({
    where: { id: waiterId },
    select: { id: true, role: true },
  });
  if (!waiter || waiter.role !== "WAITER") {
    return NextResponse.json({ error: "Radnik nije pronađen" }, { status: 404 });
  }

  const existing = await db.venueStaff.findUnique({
    where: { venueId_waiterId: { venueId: id, waiterId } },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ovaj radnik je već na spisku osoblja", staffId: existing.id },
      { status: 409 },
    );
  }

  if (isHeadPosition(position)) {
    const held = await findDepartmentHead(id, position);
    if (held) {
      return NextResponse.json(
        {
          error: `${POSITION_LABELS[position]} je već ${held.waiter.name ?? "dodeljen"} — prvo mu promenite poziciju`,
          staffId: held.id,
        },
        { status: 409 },
      );
    }
  }

  const created = await db.$transaction(async (tx) => {
    const staff = await tx.venueStaff.create({
      data: {
        venueId:    id,
        waiterId,
        position,
        department: departmentOf(position),
        employmentType,
        startedAt:  started,
        notes:      notes || null,
      },
      select: STAFF_SELECT,
    });

    // Keep management rights and the roster in agreement.
    if (isHeadPosition(position)) {
      await tx.venue.update({
        where: { id },
        data: position === "HEAD_CHEF" ? { headChefId: waiterId } : { headWaiterId: waiterId },
      });
    }

    return staff;
  });

  return NextResponse.json(created, { status: 201 });
});
