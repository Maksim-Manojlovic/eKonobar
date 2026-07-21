import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";
import { departmentOf, isPositionAllowedAtVenue, isHeadPosition } from "@/lib/staff/positions";
import { canManageRoster } from "@/lib/staff/auth";
import {
  PositionEnum, EmploymentTypeEnum, STAFF_SELECT, VENUE_AUTH_SELECT, findDepartmentHead,
} from "@/lib/staff/roster";
import { POSITION_LABELS } from "@/lib/formatting/display-maps";

type Ctx = { params: Promise<{ id: string; staffId: string }> };

const PatchSchema = z.object({
  position:       PositionEnum.optional(),
  employmentType: EmploymentTypeEnum.optional(),
  status:         z.enum(["ACTIVE", "SUSPENDED", "ENDED"]).optional(),
  endedAt:        z.string().nullish(),
  notes:          z.string().max(1000).nullish(),
});

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const { id, staffId } = await ctx.params;
  const parsed = await parseBody(PatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { position, employmentType, status, endedAt, notes } = parsed.data;

  const venue = await db.venue.findUnique({ where: { id }, select: VENUE_AUTH_SELECT });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  if (!canManageRoster(session.user.id, session.user.role, venue)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await db.venueStaff.findUnique({
    where: { id: staffId },
    select: { id: true, venueId: true, waiterId: true, position: true, status: true },
  });
  // Scope by venue as well as id — a valid staffId from another venue must 404,
  // not leak or mutate across venues.
  if (!staff || staff.venueId !== id) {
    return NextResponse.json({ error: "Radnik nije na spisku osoblja" }, { status: 404 });
  }

  if (position && !isPositionAllowedAtVenue(position, venue)) {
    return NextResponse.json(
      { error: "Ovaj lokal nema kuhinju — kuhinjske pozicije nisu dostupne" },
      { status: 400 },
    );
  }

  // Promoting into an occupied head position is rejected, same as on create.
  if (position && isHeadPosition(position) && position !== staff.position) {
    const held = await findDepartmentHead(id, position, staffId);
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

  let ended: Date | null | undefined;
  if (endedAt !== undefined) {
    if (endedAt === null || endedAt === "") {
      ended = null;
    } else {
      const d = new Date(endedAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Nevažeći datum prestanka" }, { status: 400 });
      }
      ended = d;
    }
  }
  // Ending employment without an explicit date means "today".
  if (status === "ENDED" && ended === undefined) ended = new Date();
  // Reactivating clears the end date, otherwise the row reads as both active and finished.
  if (status && status !== "ENDED" && ended === undefined) ended = null;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.venueStaff.update({
      where: { id: staffId },
      data: {
        ...(position       !== undefined && { position, department: departmentOf(position) }),
        ...(employmentType !== undefined && { employmentType }),
        ...(status         !== undefined && { status }),
        ...(ended          !== undefined && { endedAt: ended }),
        ...(notes          !== undefined && { notes: notes || null }),
      },
      select: STAFF_SELECT,
    });

    // Management rights must follow the roster. Losing the head position — by
    // demotion or by leaving — has to revoke it, or an ex-employee keeps the
    // ability to edit shifts.
    const wasHead   = isHeadPosition(staff.position);
    const isNowHead = isHeadPosition(row.position) && row.status !== "ENDED";

    if (isNowHead) {
      await tx.venue.update({
        where: { id },
        data: row.position === "HEAD_CHEF"
          ? { headChefId: staff.waiterId }
          : { headWaiterId: staff.waiterId },
      });
    } else if (wasHead) {
      await tx.venue.update({
        where: { id },
        data: staff.position === "HEAD_CHEF"
          ? { headChefId: null }
          : { headWaiterId: null },
      });
    }

    return row;
  });

  return NextResponse.json(updated);
});
