import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

// PATCH — owner or head waiter approves or rejects a swap request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ swapId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { swapId } = await params;
  const { action } = await req.json(); // "ACCEPTED" | "REJECTED"

  if (action !== "ACCEPTED" && action !== "REJECTED") {
    return NextResponse.json({ error: "action must be ACCEPTED or REJECTED" }, { status: 400 });
  }

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

    await db.$transaction([
      db.shiftAssignment.delete({ where: { id: swapReq.fromAssignmentId } }),
      db.shiftAssignment.create({ data: { shiftId, waiterId: toWaiterId } }),
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

  const fromId  = swapReq.fromAssignment.waiterId;
  const title   = swapReq.shift.title ?? "smena";
  if (action === "ACCEPTED") {
    notify(fromId, "SWAP_RESOLVED", "Zamena odobrena", `Zamena smene "${title}" je odobrena.`, `/dashboard/waiter`).catch(console.error);
    notify(swapReq.toWaiterId, "SWAP_RESOLVED", "Dodeljeni ste na smenu", `Preuzeli ste smenu "${title}".`, `/dashboard/waiter`).catch(console.error);
  } else {
    notify(fromId, "SWAP_RESOLVED", "Zamena odbijena", `Zamena smene "${title}" nije odobrena.`, `/dashboard/waiter`).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
