import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";

export const GET = withRole("ADMIN", async () => {
  const [topWaiters, topVenues] = await Promise.all([
    dbRaw.waiterPassport.findMany({
      where: { score: { gt: 0 } },
      orderBy: { score: "desc" },
      take: 5,
      select: {
        score: true,
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
  ]);

  return NextResponse.json({
    topWaiters: topWaiters.map(w => ({
      id: w.user.id,
      name: w.user.name,
      image: w.user.image,
      verificationTier: w.user.verificationTier,
      score: Math.round(w.score),
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
  });
});
