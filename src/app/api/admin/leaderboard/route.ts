import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { getEffectiveTier } from "@/lib/passport/tier";

export const GET = withRole("ADMIN", async () => {
  const now = new Date();

  const [topWaiters, topVenues, revenueByDay] = await Promise.all([
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
    dbRaw.passportPayment.findMany({
      where: {
        status: "SUCCESS",
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amountRsd: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const dayMap: Record<string, number> = {};
  for (const p of revenueByDay) {
    const day = p.createdAt.toISOString().slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + Math.round(p.amountRsd / 100);
  }
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
      isActive: getEffectiveTier(w) !== "FREE",
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
});
