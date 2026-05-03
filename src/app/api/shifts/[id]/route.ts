import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function getOwnedShift(id: string, ownerId: string) {
  return db.shift.findFirst({
    where: { id, venue: { ownerId } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedShift(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, date, startTime, endTime, role, pay, waiterId, notes } = body;

  if (waiterId !== undefined && waiterId !== null && waiterId !== "") {
    const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
    if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });
  }

  try {
    const shift = await db.shift.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        role: role !== undefined ? (role || null) : undefined,
        pay: pay !== undefined ? (pay ? Math.round(Number(pay)) : null) : undefined,
        waiterId: waiterId !== undefined ? (waiterId || null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
      },
      include: { waiter: { select: { id: true, name: true } } },
    });
    return NextResponse.json(shift);
  } catch (err) {
    console.error("[PATCH /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOwnedShift(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await db.shift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/shifts]", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
