import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "HEADHUNTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const saved = await db.savedProfile.findMany({
    where: { headhunterId: session.user.id },
    include: {
      // savedWaiterId is just a string FK — fetch user data separately
    },
    orderBy: { savedAt: "desc" },
  });

  // Enrich with waiter passport data
  const waiterIds = saved.map((s) => s.savedWaiterId);
  const waiters = await db.user.findMany({
    where: { id: { in: waiterIds }, role: "WAITER" },
    select: {
      id: true, name: true, verificationTier: true,
      waiterPassport: {
        select: {
          score: true, skills: true, languages: true,
          yearsExperience: true, sanitaryBookValid: true,
          currentlyAvailable: true, badges: true,
          reviewCount: true, totalEngagements: true,
          shareToken: true, passportTier: true, subscriptionExpiresAt: true,
        },
      },
    },
  });

  const waiterMap = new Map(waiters.map((w) => [w.id, w]));

  const result = saved.map((s) => ({
    savedAt: s.savedAt,
    notes: s.notes,
    waiter: waiterMap.get(s.savedWaiterId) ?? null,
  })).filter((r) => r.waiter !== null);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "HEADHUNTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { waiterId, notes } = await req.json();
  if (!waiterId) return NextResponse.json({ error: "waiterId required" }, { status: 400 });

  const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  const saved = await db.savedProfile.upsert({
    where: { headhunterId_savedWaiterId: { headhunterId: session.user.id, savedWaiterId: waiterId } },
    create: { headhunterId: session.user.id, savedWaiterId: waiterId, notes: notes ?? null },
    update: { notes: notes ?? null },
  });

  return NextResponse.json(saved, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "HEADHUNTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { waiterId } = await req.json();
  if (!waiterId) return NextResponse.json({ error: "waiterId required" }, { status: 400 });

  await db.savedProfile.deleteMany({
    where: { headhunterId: session.user.id, savedWaiterId: waiterId },
  });

  return NextResponse.json({ deleted: true });
}
