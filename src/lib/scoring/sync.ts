import { dbRaw } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";
import {
  calculateVenueTrustScore,
  calculateVenueScoreDimensions,
  calculatePassportScore,
  calculatePassportScoreDimensions,
} from "@/lib/scoring/trust-score";

// ─── Venue trust score sync ───────────────────────────────────────────────────

/**
 * Preračunava Trust Score za lokal na osnovu svih PUBLISHED WAITER_TO_VENUE recenzija.
 * Poziva se nakon objave nove recenzije ili iz cron job-a.
 */
export async function syncVenueTrustScore(venueId: string): Promise<void> {
  const reviews = await dbRaw.review.findMany({
    where: {
      venueId,
      direction: { in: ["WAITER_TO_VENUE", "GUEST_TO_VENUE"] },
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
    select: { id: true, totalEngagements: true, sanitaryBookValid: true, badges: true },
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

  // Compute badges from scratch — all conditions are deterministic from current
  // passport state, so starting from an empty set makes writes idempotent and
  // eliminates the read-modify-write race when concurrent syncs run simultaneously.
  // "verified_history" / "hospitality_pro" are still permanent (totalEngagements
  // never decreases); "platinum" correctly reverts when score drops below 98.
  const earned = new Set<string>();
  if (passport.sanitaryBookValid) earned.add("sanitarna");
  if (passport.totalEngagements >= 3) earned.add("verified_history");
  if (passport.totalEngagements >= 50) earned.add("hospitality_pro");
  if (score >= 98) earned.add("platinum");
  const badges = Array.from(earned);

  // Bump the waiter search cache generation — all cached search result pages
  // are now stale and will be re-fetched on next query (old keys expire via TTL).
  if (redis) redis.incr("waiter:search:gen").catch(() => {});

  await dbRaw.$transaction([
    dbRaw.waiterPassport.update({
      where: { id: passport.id },
      data: { score, reviewCount, badges },
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
