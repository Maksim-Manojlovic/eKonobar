import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { fireSideEffects } from "@/lib/side-effects";

export const POST = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { toWaiterId } = await req.json();

  if (!toWaiterId) {
    return NextResponse.json({ error: "toWaiterId required" }, { status: 400 });
  }

  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      assignments: { select: { id: true, waiterId: true } },
      venue: { select: { ownerId: true, name: true } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (shift.swapLocked) {
    return NextResponse.json({ error: "Zamene su blokirane za ovu smenu" }, { status: 409 });
  }
  if (shift.scheduledStart && shift.scheduledStart <= new Date()) {
    return NextResponse.json({ error: "Smena je već počela" }, { status: 409 });
  }

  const myAssignment = shift.assignments.find(a => a.waiterId === session.user.id);
  if (!myAssignment) {
    return NextResponse.json({ error: "Niste na ovoj smeni" }, { status: 403 });
  }

  const toWaiter = await db.user.findUnique({ where: { id: toWaiterId, role: "WAITER" } });
  if (!toWaiter) return NextResponse.json({ error: "Konobar nije pronađen" }, { status: 404 });

  let swapReq;
  try {
    swapReq = await db.$transaction(async (tx) => {
      // Lock the assignment row so concurrent swap requests for the same
      // assignment are serialised — prevents duplicate PENDING swap creation
      await tx.$queryRaw`SELECT id FROM "ShiftAssignment" WHERE id = ${myAssignment.id} FOR UPDATE`;

      const existingPending = await tx.shiftSwapRequest.findFirst({
        where: { fromAssignmentId: myAssignment.id, status: "PENDING" },
      });
      if (existingPending) throw Object.assign(new Error("conflict"), { code: "CONFLICT" });

      const swapRequest = await tx.shiftSwapRequest.create({
        data: { shiftId: id, fromAssignmentId: myAssignment.id, toWaiterId },
      });
      await tx.shift.update({ where: { id }, data: { status: "PENDING_SWAP" } });
      return swapRequest;
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "CONFLICT") {
      return NextResponse.json({ error: "Zahtev za zamenu već postoji" }, { status: 409 });
    }
    throw err;
  }

  const fromName = session.user.name ?? "Konobar";
  fireSideEffects({
    notifications: [
      {
        userId: toWaiterId,
        type:   "SWAP_REQUESTED",
        title:  "Zahtev za zamenu smene",
        body:   `${fromName} traži zamenu za smenu "${shift.title}"`,
        link:   "/dashboard/waiter",
      },
      {
        userId: shift.venue.ownerId,
        type:   "SWAP_REQUESTED",
        title:  "Zahtev za zamenu",
        body:   `${fromName} traži zamenu smene "${shift.title}"`,
        link:   "/dashboard/venue",
      },
    ],
  });

  return NextResponse.json(swapReq, { status: 201 });
});
