import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const SwapResolvePatchSchema = z.object({
  action: z.enum(["ACCEPTED", "REJECTED"]),
});

// PATCH — owner or head waiter approves or rejects a swap request
export const PATCH = withRole<{ params: Promise<{ swapId: string }> }>(["VENUE_OWNER", "WAITER"], async (req, ctx, session) => {
  const { swapId } = await ctx.params;
  const parsed = await parseBody(SwapResolvePatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

  const swapReq = await db.shiftSwapRequest.findUnique({
    where: { id: swapId },
    include: {
      shift: { include: { venue: { select: { ownerId: true, headWaiterId: true } }, assignments: { select: { waiterId: true } } } },
      fromAssignment: { select: { id: true, waiterId: true } },
    },
  });

  if (!swapReq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const venue = swapReq.shift.venue;
  const canManage =
    (session.user.role === "VENUE_OWNER" && venue.ownerId === session.user.id) ||
    (session.user.role === "WAITER" && venue.headWaiterId === session.user.id);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (swapReq.status !== "PENDING") {
    return NextResponse.json({ error: "Zahtev više nije na čekanju" }, { status: 409 });
  }

  if (action === "ACCEPTED") {
    const shiftId = swapReq.shiftId;
    const toWaiterId = swapReq.toWaiterId;

    // check toWaiter not already on shift
    if (swapReq.shift.assignments.some(a => a.waiterId === toWaiterId)) {
      return NextResponse.json({ error: "Konobar je već na ovoj smeni" }, { status: 409 });
    }

    // Transfer the existing assignment to toWaiter instead of delete+create.
    // delete+create fails with FK violation: ShiftSwapRequest.fromAssignmentId
    // has ON DELETE RESTRICT and still references the assignment during the
    // transaction. Updating waiterId in-place avoids the constraint entirely.
    await db.$transaction([
      db.shiftAssignment.update({
        where: { id: swapReq.fromAssignmentId },
        data:  { waiterId: toWaiterId },
      }),
      db.shiftSwapRequest.update({
        where: { id: swapId },
        data: { status: "ACCEPTED", resolvedAt: new Date() },
      }),
      db.shift.update({ where: { id: shiftId }, data: { status: "ASSIGNED" } }),
    ]);
  } else {
    await db.$transaction([
      db.shiftSwapRequest.update({
        where: { id: swapId },
        data: { status: "REJECTED", resolvedAt: new Date() },
      }),
      db.shift.update({ where: { id: swapReq.shiftId }, data: { status: "ASSIGNED" } }),
    ]);
  }

  const fromId = swapReq.fromAssignment.waiterId;
  const title  = swapReq.shift.title ?? "smena";
  fireSideEffects({
    notifications: action === "ACCEPTED"
      ? [
          { userId: fromId,             type: "SWAP_RESOLVED", title: "Zamena odobrena",       body: `Zamena smene "${title}" je odobrena.`,     link: "/dashboard/waiter" },
          { userId: swapReq.toWaiterId, type: "SWAP_RESOLVED", title: "Dodeljeni ste na smenu", body: `Preuzeli ste smenu "${title}".`,           link: "/dashboard/waiter" },
        ]
      : [
          { userId: fromId,             type: "SWAP_RESOLVED", title: "Zamena odbijena",        body: `Zamena smene "${title}" nije odobrena.`,   link: "/dashboard/waiter" },
        ],
  });

  return NextResponse.json({ ok: true });
});
