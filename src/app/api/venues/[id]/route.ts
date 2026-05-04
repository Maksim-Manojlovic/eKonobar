import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const venue = await db.venue.findUnique({
    where: { id },
    include: {
      venueTrustScore: true,
      _count: { select: { jobPosts: true, reviews: true } },
      jobPosts: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          engagementType: true,
          salaryMin: true,
          salaryMax: true,
          tipSystem: true,
          sanitaryRequired: true,
          redAlert: true,
          redAlertNote: true,
          startDate: true,
          _count: { select: { applications: true } },
        },
        orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
        take: 10,
      },
      zones: {
        select: { zone: { select: { name: true, zoneType: true, projectedGrowthPercent: true, operatorTip: true } } },
      },
    },
  });

  if (!venue) {
    return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  }

  // Fetch recent published reviews separately (exclude private fields)
  const reviews = await db.review.findMany({
    where: { venueId: id, direction: "WAITER_TO_VENUE", status: "PUBLISHED" },
    select: {
      id: true,
      overallRating: true,
      comment: true,
      publishedAt: true,
      ratingAtmosphere: true,
      ratingOrganization: true,
      ratingPay: true,
      ratingTips: true,
      ratingHygieneWork: true,
      ratingManagement: true,
      author: { select: { name: true, verificationTier: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ...venue, recentReviews: reviews });
}
