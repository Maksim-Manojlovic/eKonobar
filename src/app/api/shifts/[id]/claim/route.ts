import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { acquireLock, releaseLock } from "@/lib/core/redis-lock";
import logger from "@/lib/core/logger";
import { isOnLeave } from "@/lib/leave/conflicts";

export const POST = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (_req, ctx, session) => {
  const { id } = await ctx.params;

  const lockKey = `shift:claim:lock:${id}`;
  const lock    = await acquireLock(lockKey, 5000);

  if (!lock.acquired) {
    if (lock.reason === "contended") {
      // Another request holds the lock — shift is being claimed right now.
      return NextResponse.json({ error: "Smena je zauzeta, pokušajte ponovo" }, { status: 409 });
    }
    // Redis unavailable — proceed without distributed lock.
    // The @@unique([shiftId, waiterId]) DB constraint still prevents the same
    // waiter from double-claiming, but concurrent different-waiter overclaims
    // remain possible until Redis is restored.
    logger.warn({ shiftId: id }, "shift claim proceeding without distributed lock (Redis unavailable)");
  }

  try {
    const shift = await db.shift.findUnique({
      where: { id },
      include: {
        assignments: { select: { waiterId: true } },
        venue: { select: { ownerId: true, name: true } },
      },
    });
    if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (shift.status !== "OPEN") {
      return NextResponse.json({ error: "Smena nije dostupna za preuzimanje" }, { status: 409 });
    }
    if (shift.assignments.some(a => a.waiterId === session.user.id)) {
      return NextResponse.json({ error: "Već ste na ovoj smeni" }, { status: 409 });
    }
    if (shift.assignments.length >= shift.requiredCount) {
      return NextResponse.json({ error: "Smena je popunjena" }, { status: 409 });
    }

    // Hard block: a worker must not be able to book themselves onto a day they
    // already have approved off. A manager may still assign them directly —
    // that path only warns.
    if (await isOnLeave(session.user.id, shift.date)) {
      return NextResponse.json(
        { error: "Imate odobreno odsustvo tog dana" },
        { status: 409 },
      );
    }

    const newCount  = shift.assignments.length + 1;
    const newStatus = newCount >= shift.requiredCount ? "ASSIGNED" : "OPEN";

    const [assignment] = await db.$transaction([
      db.shiftAssignment.create({
        data: { shiftId: id, waiterId: session.user.id },
      }),
      db.shift.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    fireSideEffects({
      notifications: [{
        userId: shift.venue.ownerId,
        type:   "SHIFT_CLAIMED",
        title:  "Smena preuzeta",
        body:   `${session.user.name ?? "Konobar"} je preuzeo smenu "${shift.title}"`,
        link:   "/dashboard/venue",
      }],
    });

    return NextResponse.json(assignment, { status: 201 });
  } finally {
    if (lock.acquired) {
      await releaseLock(lockKey, lock.token);
    }
  }
});
