import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";

export const GET = withRole("HEADHUNTER", async (_req, _ctx, session) => {
  const saved = await db.savedProfile.findMany({
    where: { headhunterId: session.user.id },
    include: {},
    orderBy: { savedAt: "desc" },
  });

  // Enrich with waiter passport data
  const waiterIds = saved.map((s) => s.savedWaiterId);
  const waiters = await db.user.findMany({
    where: { id: { in: waiterIds }, role: "WAITER" },
    select: {
      id: true, name: true, image: true, verificationTier: true,
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
});

export const POST = withRole("HEADHUNTER", async (req, _ctx, session) => {
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
});

export const DELETE = withRole("HEADHUNTER", async (req, _ctx, session) => {
  const { waiterId } = await req.json();
  if (!waiterId) return NextResponse.json({ error: "waiterId required" }, { status: 400 });

  await db.savedProfile.deleteMany({
    where: { headhunterId: session.user.id, savedWaiterId: waiterId },
  });

  return NextResponse.json({ deleted: true });
});
