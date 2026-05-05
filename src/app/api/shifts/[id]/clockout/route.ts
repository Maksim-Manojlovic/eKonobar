import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScheduledEnd } from "@/lib/shift-utils";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

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
}
