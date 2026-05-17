import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const [topWaiters, topVenues, revenueByDay] = await Promise.all([
    // Top 5 waiters by passport score
    dbRaw.waiterPassport.findMany({
      where: { score: { gt: 0 } },
      orderBy: { score: "desc" },
      take: 5,
      select: {
        score: true,
        passportTier: true,
        subscriptionExpiresAt: true,
        reviewCount: true,
        totalEngagements: true,
        user: { select: { id: true, name: true, image: true, verificationTier: true } },
      },
    }),

    // Top 5 venues by trust score
    dbRaw.venueTrustScore.findMany({
      where: { composite: { gt: 0 } },
      orderBy: { composite: "desc" },
      take: 5,
      select: {
        composite: true,
        sampleSize: true,
        venue: { select: { id: true, name: true, municipality: true, logo: true } },
      },
    }),

    // Daily revenue for last 30 days (SUCCESS payments)
    dbRaw.passportPayment.findMany({
      where: {
        status: "SUCCESS",
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amountRsd: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Aggregate daily revenue
  const dayMap: Record<string, number> = {};
  for (const p of revenueByDay) {
    const day = p.createdAt.toISOString().slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + Math.round(p.amountRsd / 100);
  }
  // Fill all 30 days (0 for days with no payments)
  const days: { date: string; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, revenue: dayMap[key] ?? 0 });
  }

  return NextResponse.json({
    topWaiters: topWaiters.map(w => ({
      id: w.user.id,
      name: w.user.name,
      image: w.user.image,
      verificationTier: w.user.verificationTier,
      score: Math.round(w.score),
      passportTier: w.passportTier,
      isActive: w.subscriptionExpiresAt ? w.subscriptionExpiresAt > now : false,
      reviewCount: w.reviewCount,
      totalEngagements: w.totalEngagements,
    })),
    topVenues: topVenues.map(v => ({
      id: v.venue.id,
      name: v.venue.name,
      municipality: v.venue.municipality,
      logo: v.venue.logo,
      score: Math.round(v.composite),
      reviewCount: v.sampleSize,
    })),
    revenue: days,
  });
}
