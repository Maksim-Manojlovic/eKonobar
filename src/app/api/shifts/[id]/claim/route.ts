import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const shift = await db.shift.findUnique({
    where: { id },
    include: { assignments: { select: { waiterId: true } } },
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

  return NextResponse.json(assignment, { status: 201 });
}
