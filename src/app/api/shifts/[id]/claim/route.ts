import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export const POST = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (_req, ctx, session) => {
  const { id } = await ctx.params;

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

  const newCount = shift.assignments.length + 1;
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

  notify(
    shift.venue.ownerId,
    "SHIFT_CLAIMED",
    "Smena preuzeta",
    `${session.user.name ?? "Konobar"} je preuzeo smenu "${shift.title}"`,
    `/dashboard/venue`,
  ).catch(console.error);

  return NextResponse.json(assignment, { status: 201 });
});
