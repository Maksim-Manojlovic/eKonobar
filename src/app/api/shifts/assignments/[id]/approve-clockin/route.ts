import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json(); // "approve" | "reject"
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action mora biti 'approve' ili 'reject'" }, { status: 400 });
  }

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

  const waiterName = assignment.waiter.name ?? "Konobar";
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

    notify(
      assignment.waiter.id,
      "CLOCKIN_RESOLVED",
      "Prijava odobrena",
      `Vlasnik je odobrio tvoju prijavu na smenu "${shiftTitle}"`,
      "/dashboard/waiter",
    ).catch(console.error);

    return NextResponse.json(updated);
  }

  // reject
  await db.shiftAssignment.update({
    where: { id },
    data: { pendingClockIn: false },
  });

  notify(
    assignment.waiter.id,
    "CLOCKIN_RESOLVED",
    "Prijava odbijena",
    `Vlasnik nije odobrio prijavu na smenu "${shiftTitle}". Kontaktiraj vlasnika.`,
    "/dashboard/waiter",
  ).catch(console.error);

  return NextResponse.json({ ok: true });
}
