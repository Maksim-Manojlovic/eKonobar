import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await params;

  const passport = await db.waiterPassport.findUnique({
    where: { shareToken },
    select: {
      id: true,
      userId: true,
      score: true,
      badges: true,
      reviewCount: true,
      totalEngagements: true,
      avgEngagementMonths: true,
      skills: true,
      languages: true,
      yearsExperience: true,
      sanitaryBookValid: true,
      sanitaryExpiry: true,
      currentlyAvailable: true,
      bio: true,
      profilePhoto: true,
      galleryPhotos: true,
      venueTypePreferences: true,
      avgRedAlertResponseMinutes: true,
      redAlertResponseCount: true,
      lastAvailableDate: true,
      passportTier: true,
      createdAt: true,
      shareTokenExpiry: true,
      trustScore: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          verificationTier: true,
          createdAt: true,
        },
      },
    },
  });

  if (!passport) {
    return NextResponse.json({ error: "Profil nije pronađen" }, { status: 404 });
  }

  if (passport.shareTokenExpiry && passport.shareTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Link je istekao" }, { status: 410 });
  }

  // Fetch verified engagement records
  const engagements = await db.engagementRecord.findMany({
    where: { waiterId: passport.userId },
    select: {
      id: true,
      engagementType: true,
      startDate: true,
      endDate: true,
      verified: true,
      verifiedAt: true,
      venue: { select: { id: true, name: true, municipality: true, venueType: true } },
    },
    orderBy: { startDate: "desc" },
    take: 20,
  });

  // Fetch recent published reviews (no private geolocation data)
  const reviews = await db.review.findMany({
    where: {
      subjectId: passport.userId,
      status: "PUBLISHED",
      direction: { in: ["VENUE_TO_WAITER", "GUEST_TO_WAITER"] },
    },
    select: {
      id: true,
      direction: true,
      overallRating: true,
      comment: true,
      publishedAt: true,
      ratingPunctuality: true,
      ratingSkill: true,
      ratingGuestCommunication: true,
      ratingPersonalHygiene: true,
      ratingTeamwork: true,
      ratingSpeed: true,
      ratingFriendliness: true,
      ratingGuestSpeed: true,
      ratingAttentiveness: true,
      author: { select: { name: true, verificationTier: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { shareTokenExpiry: _exp, ...publicPassport } = passport;

  return NextResponse.json({
    passport: publicPassport,
    engagements,
    reviews,
  });
}
