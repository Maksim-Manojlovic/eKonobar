import { dbRaw } from "@/lib/db";
import {
  calculateVenueTrustScore,
  calculateVenueScoreDimensions,
  calculatePassportScore,
  calculatePassportScoreDimensions,
} from "@/lib/trust-score";

// ─── Review publish ───────────────────────────────────────────────────────────

/**
 * Objavljuje sve PENDING recenzije čiji je pendingUntil prošao.
 * Poziva se iz cron job-a (npr. svakih 15 min).
 * Vraća broj objavljenih recenzija.
 */
export async function publishDueReviews(): Promise<number> {
  const now = new Date();
  const result = await dbRaw.review.updateMany({
    where: {
      status: "PENDING",
      pendingUntil: { lte: now },
    },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
    },
  });
  return result.count;
}

// ─── Venue trust score sync ───────────────────────────────────────────────────

/**
 * Preračunava Trust Score za lokal na osnovu svih PUBLISHED WAITER_TO_VENUE recenzija.
 * Poziva se nakon objave nove recenzije ili iz cron job-a.
 */
export async function syncVenueTrustScore(venueId: string): Promise<void> {
  const reviews = await dbRaw.review.findMany({
    where: {
      venueId,
      direction: "WAITER_TO_VENUE",
      status: "PUBLISHED",
    },
    select: {
      weight: true,
      createdAt: true,
      ratingAtmosphere: true,
      ratingOrganization: true,
      ratingPay: true,
      ratingTips: true,
      ratingHygieneWork: true,
      ratingManagement: true,
    },
  });

  const score = calculateVenueTrustScore(reviews);
  const dimensions = calculateVenueScoreDimensions(reviews);

  await dbRaw.$transaction([
    dbRaw.venue.update({
      where: { id: venueId },
      data: { trustScore: score },
    }),
    dbRaw.venueTrustScore.upsert({
      where: { venueId },
      create: {
        venueId,
        atmosphere: dimensions.atmosphere,
        organization: dimensions.organization,
        pay: dimensions.pay,
        tips: dimensions.tips,
        hygieneStandards: dimensions.hygiene,
        management: dimensions.management,
        composite: score,
        sampleSize: reviews.length,
      },
      update: {
        atmosphere: dimensions.atmosphere,
        organization: dimensions.organization,
        pay: dimensions.pay,
        tips: dimensions.tips,
        hygieneStandards: dimensions.hygiene,
        management: dimensions.management,
        composite: score,
        sampleSize: reviews.length,
      },
    }),
  ]);
}

// ─── Waiter passport score sync ───────────────────────────────────────────────

/**
 * Preračunava Passport Score za konobara na osnovu PUBLISHED recenzija
 * oba tipa (VENUE_TO_WAITER i GUEST_TO_WAITER).
 */
export async function syncPassportScore(waiterId: string): Promise<void> {
  const passport = await dbRaw.waiterPassport.findUnique({
    where: { userId: waiterId },
    select: { id: true },
  });
  if (!passport) return;

  const reviewSelect = {
    weight: true,
    createdAt: true,
    ratingPunctuality: true,
    ratingSkill: true,
    ratingGuestCommunication: true,
    ratingPersonalHygiene: true,
    ratingTeamwork: true,
    ratingSpeed: true,
    ratingFriendliness: true,
    ratingGuestSpeed: true,
    ratingAttentiveness: true,
  } as const;

  const [venueReviews, guestReviews] = await Promise.all([
    dbRaw.review.findMany({
      where: { subjectId: waiterId, direction: "VENUE_TO_WAITER", status: "PUBLISHED" },
      select: reviewSelect,
    }),
    dbRaw.review.findMany({
      where: { subjectId: waiterId, direction: "GUEST_TO_WAITER", status: "PUBLISHED" },
      select: reviewSelect,
    }),
  ]);

  const score = calculatePassportScore(venueReviews, guestReviews);
  const dimensions = calculatePassportScoreDimensions(venueReviews);
  const reviewCount = venueReviews.length + guestReviews.length;

  await dbRaw.$transaction([
    dbRaw.waiterPassport.update({
      where: { id: passport.id },
      data: { score, reviewCount },
    }),
    dbRaw.passportTrustScore.upsert({
      where: { passportId: passport.id },
      create: {
        passportId: passport.id,
        punctuality: dimensions.punctuality,
        skill: dimensions.skill,
        guestCommunication: dimensions.communication,
        personalHygiene: dimensions.hygiene,
        teamwork: dimensions.teamwork,
        speed: dimensions.speed,
        composite: score,
        sampleSize: reviewCount,
      },
      update: {
        punctuality: dimensions.punctuality,
        skill: dimensions.skill,
        guestCommunication: dimensions.communication,
        personalHygiene: dimensions.hygiene,
        teamwork: dimensions.teamwork,
        speed: dimensions.speed,
        composite: score,
        sampleSize: reviewCount,
      },
    }),
  ]);
}
