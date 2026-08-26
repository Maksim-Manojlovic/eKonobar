import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { computeScheduledEnd } from "@/lib/shifts/utils";

export const POST = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (_req, ctx, session) => {
  const { id } = await ctx.params;

  const shift = await db.shift.findUnique({
    where: { id },
    include: { assignments: { where: { waiterId: session.user.id } } },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assignment = shift.assignments[0];
  if (!assignment) return NextResponse.json({ error: "Niste na ovoj smeni" }, { status: 403 });
  if (!assignment.clockInAt) return NextResponse.json({ error: "Niste čekirani" }, { status: 409 });
  if (assignment.clockOutAt) return NextResponse.json({ error: "Već ste se odjavili" }, { status: 409 });

  const now = new Date();
  const scheduledEnd = computeScheduledEnd(
    shift.date.toISOString().slice(0, 10),
    shift.startTime,
    shift.endTime,
  );
  const earlyExit = now < scheduledEnd ? now : null;

  const updated = await db.shiftAssignment.update({
    where: { id: assignment.id },
    data: {
      clockOutAt: now,
      ...(earlyExit && { earlyExitAt: earlyExit }),
    },
  });

  return NextResponse.json(updated);
});
