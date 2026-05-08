import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PUT — venue owner appoints a head waiter
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: venueId } = await params;
  const { waiterId } = await req.json();
  if (!waiterId) return NextResponse.json({ error: "waiterId required" }, { status: 400 });

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
  if (!waiter) return NextResponse.json({ error: "Konobar nije pronađen" }, { status: 404 });

  const updated = await db.venue.update({
    where: { id: venueId },
    data: { headWaiterId: waiterId },
    select: {
      id: true,
      headWaiterId: true,
      headWaiter: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — venue owner removes the current head waiter
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: venueId } = await params;

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const updated = await db.venue.update({
    where: { id: venueId },
    data: { headWaiterId: null },
    select: { id: true, headWaiterId: true },
  });

  return NextResponse.json(updated);
}
