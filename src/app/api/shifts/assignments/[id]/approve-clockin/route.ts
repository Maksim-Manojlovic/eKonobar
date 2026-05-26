import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ApproveClockInSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("VENUE_OWNER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(ApproveClockInSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

  const assignment = await db.shiftAssignment.findUnique({
    where: { id },
    include: {
      shift: {
        include: { venue: { select: { ownerId: true, name: true } } },
      },
      waiter: { select: { id: true, name: true } },
    },
  });

  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (assignment.shift.venue.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!assignment.pendingClockIn) {
    return NextResponse.json({ error: "Nema zahteva za odobrenje" }, { status: 409 });
  }

  const shiftTitle = assignment.shift.title;

  if (action === "approve") {
    const now = new Date();
    const lateMinutes = assignment.shift.scheduledStart
      ? Math.max(0, Math.round((now.getTime() - assignment.shift.scheduledStart.getTime()) / 60000))
      : null;

    const updated = await db.shiftAssignment.update({
      where: { id },
      data: {
        clockInAt: now,
        clockInMethod: "MANUAL",
        lateMinutes,
        pendingClockIn: false,
      },
    });

    fireSideEffects({
      notifications: [{
        userId: assignment.waiter.id,
        type:   "CLOCKIN_RESOLVED",
        title:  "Prijava odobrena",
        body:   `Vlasnik je odobrio tvoju prijavu na smenu "${shiftTitle}"`,
        link:   "/dashboard/waiter",
      }],
    });

    return NextResponse.json(updated);
  }

  // reject
  await db.shiftAssignment.update({
    where: { id },
    data: { pendingClockIn: false },
  });

  fireSideEffects({
    notifications: [{
      userId: assignment.waiter.id,
      type:   "CLOCKIN_RESOLVED",
      title:  "Prijava odbijena",
      body:   `Vlasnik nije odobrio prijavu na smenu "${shiftTitle}". Kontaktiraj vlasnika.`,
      link:   "/dashboard/waiter",
    }],
  });

  return NextResponse.json({ ok: true });
});
