import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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

      const req = await tx.shiftSwapRequest.create({
        data: { shiftId: id, fromAssignmentId: myAssignment.id, toWaiterId },
      });
      await tx.shift.update({ where: { id }, data: { status: "PENDING_SWAP" } });
      return req;
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "CONFLICT") {
      return NextResponse.json({ error: "Zahtev za zamenu već postoji" }, { status: 409 });
    }
    throw err;
  }

  const fromName = session.user.name ?? "Konobar";
  // Notify target waiter
  notify(toWaiterId, "SWAP_REQUESTED", "Zahtev za zamenu smene",
    `${fromName} traži zamenu za smenu "${shift.title}"`, `/dashboard/waiter`).catch(console.error);
  // Notify venue owner
  notify(shift.venue.ownerId, "SWAP_REQUESTED", "Zahtev za zamenu",
    `${fromName} traži zamenu smene "${shift.title}"`, `/dashboard/venue`).catch(console.error);

  return NextResponse.json(swapReq, { status: 201 });
}
