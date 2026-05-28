import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { syncVenueTrustScore, syncPassportScore } from "../sync";
import { dbRaw } from "@/lib/core/db";
import { SITE_AVERAGE } from "../trust-score";

// Validates that the real $transaction([venue.update, venueTrustScore.upsert])
// and $transaction([waiterPassport.update, passportTrustScore.upsert]) work
// correctly end-to-end, and that the upsert create/update paths both execute.
// Unit tests mocked $transaction and never ran the actual operations.

async function createVenue(ownerId: string) {
  return dbRaw.venue.create({
    data: {
      ownerId,
      name:         "Integration Venue",
      address:      "Test Street 1",
      municipality: "Beograd",
      venueType:    "RESTAURANT",
      latitude:     44.8176,
      longitude:    20.4569,
    },
  });
}

async function seedVenueReview(venueId: string, overrides: Record<string, unknown> = {}) {
  return dbRaw.review.create({
    data: {
      venueId,
      direction:          "WAITER_TO_VENUE",
      status:             "PUBLISHED",
      overallRating:      80,
      weight:             1.0,
      ratingAtmosphere:   80,
      ratingOrganization: 70,
      ratingPay:          60,
      ratingTips:         50,
      ratingHygieneWork:  75,
      ratingManagement:   65,
      ...overrides,
    },
  });
}

async function seedWaiterReview(waiterId: string, venueId: string, overrides: Record<string, unknown> = {}) {
  return dbRaw.review.create({
    data: {
      subjectId:              waiterId,
      venueId,
      direction:              "VENUE_TO_WAITER",
      status:                 "PUBLISHED",
      overallRating:          80,
      weight:                 1.0,
      ratingPunctuality:      80,
      ratingSkill:            80,
      ratingGuestCommunication: 80,
      ratingPersonalHygiene:  80,
      ratingTeamwork:         80,
      ratingSpeed:            80,
      ...overrides,
    },
  });
}

// ── syncVenueTrustScore ───────────────────────────────────────────────────────

describe("syncVenueTrustScore — real DB transactions", () => {
  let ownerId: string;
  let venueId: string;

  beforeEach(async () => {
    await resetDb();
    ownerId  = await seedUser({ role: "VENUE_OWNER" });
    const v  = await createVenue(ownerId);
    venueId  = v.id;
  });

  it("no reviews → score equals SITE_AVERAGE (Bayesian prior)", async () => {
    await syncVenueTrustScore(venueId);
    const venue = await dbRaw.venue.findUnique({ where: { id: venueId } });
    expect(venue!.trustScore).toBe(SITE_AVERAGE);
  });

  it("upsert CREATE path: VenueTrustScore row created on first sync", async () => {
    const before = await dbRaw.venueTrustScore.findUnique({ where: { venueId } });
    expect(before).toBeNull();

    await syncVenueTrustScore(venueId);

    const after = await dbRaw.venueTrustScore.findUnique({ where: { venueId } });
    expect(after).not.toBeNull();
    expect(after!.sampleSize).toBe(0);
  });

  it("upsert UPDATE path: second sync updates existing VenueTrustScore", async () => {
    await syncVenueTrustScore(venueId); // creates with sampleSize=0
    await seedVenueReview(venueId);
    await syncVenueTrustScore(venueId); // updates with sampleSize=1

    const score = await dbRaw.venueTrustScore.findUnique({ where: { venueId } });
    expect(score!.sampleSize).toBe(1);
  });

  it("PUBLISHED reviews raise score above SITE_AVERAGE", async () => {
    await seedVenueReview(venueId, {
      ratingAtmosphere: 90, ratingOrganization: 90, ratingPay: 90,
      ratingTips: 90, ratingHygieneWork: 90, ratingManagement: 90,
    });
    await syncVenueTrustScore(venueId);
    const venue = await dbRaw.venue.findUnique({ where: { id: venueId } });
    expect(venue!.trustScore).toBeGreaterThan(SITE_AVERAGE);
  });

  it("PENDING reviews excluded — score stays at prior", async () => {
    // All-zero PENDING review should not drag score down
    await seedVenueReview(venueId, {
      status: "PENDING",
      ratingAtmosphere: 0, ratingOrganization: 0, ratingPay: 0,
      ratingTips: 0, ratingHygieneWork: 0, ratingManagement: 0,
    });
    await syncVenueTrustScore(venueId);
    const venue = await dbRaw.venue.findUnique({ where: { id: venueId } });
    expect(venue!.trustScore).toBe(SITE_AVERAGE);
  });

  it("$transaction atomic: venue.trustScore === VenueTrustScore.composite", async () => {
    await seedVenueReview(venueId);
    await syncVenueTrustScore(venueId);
    const venue = await dbRaw.venue.findUnique({ where: { id: venueId } });
    const vts   = await dbRaw.venueTrustScore.findUnique({ where: { venueId } });
    // Both written in same $transaction — must be identical
    expect(venue!.trustScore).toBe(vts!.composite);
  });

  it("GUEST_TO_VENUE reviews are included in score", async () => {
    await dbRaw.review.create({
      data: {
        venueId,
        direction:         "GUEST_TO_VENUE",
        status:            "PUBLISHED",
        overallRating:     90,
        weight:            1.0,
        ratingAtmosphere:  90,
        ratingOrganization:90,
        ratingPay:         90,
        ratingTips:        90,
        ratingHygieneWork: 90,
        ratingManagement:  90,
      },
    });
    await syncVenueTrustScore(venueId);
    const vts = await dbRaw.venueTrustScore.findUnique({ where: { venueId } });
    expect(vts!.sampleSize).toBe(1);
    expect(vts!.composite).toBeGreaterThan(SITE_AVERAGE);
  });
});

// ── syncPassportScore ─────────────────────────────────────────────────────────

describe("syncPassportScore — real DB transactions", () => {
  let waiterId: string;
  let ownerId: string;
  let venueId: string;
  let passportId: string;

  beforeEach(async () => {
    await resetDb();
    waiterId = await seedUser({ role: "WAITER" });
    ownerId  = await seedUser({ role: "VENUE_OWNER" });
    const v  = await createVenue(ownerId);
    venueId  = v.id;
    const p  = await dbRaw.waiterPassport.create({ data: { userId: waiterId } });
    passportId = p.id;
  });

  it("no passport → returns early, no DB writes", async () => {
    await dbRaw.waiterPassport.delete({ where: { id: passportId } });
    await syncPassportScore(waiterId); // must not throw
    const scores = await dbRaw.passportTrustScore.findMany({ where: { passportId } });
    expect(scores).toHaveLength(0);
  });

  it("upsert CREATE path: PassportTrustScore created on first sync", async () => {
    await syncPassportScore(waiterId);
    const score = await dbRaw.passportTrustScore.findUnique({ where: { passportId } });
    expect(score).not.toBeNull();
    expect(score!.sampleSize).toBe(0);
  });

  it("upsert UPDATE path: second sync updates existing PassportTrustScore", async () => {
    await syncPassportScore(waiterId);
    await seedWaiterReview(waiterId, venueId);
    await syncPassportScore(waiterId);
    const score = await dbRaw.passportTrustScore.findUnique({ where: { passportId } });
    expect(score!.sampleSize).toBe(1);
  });

  it("$transaction atomic: passport.score === PassportTrustScore.composite", async () => {
    await seedWaiterReview(waiterId, venueId);
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    const score    = await dbRaw.passportTrustScore.findUnique({ where: { passportId } });
    expect(passport!.score).toBe(score!.composite);
  });

  it("PUBLISHED VENUE_TO_WAITER reviews raise score above SITE_AVERAGE", async () => {
    await seedWaiterReview(waiterId, venueId, {
      ratingPunctuality: 90, ratingSkill: 90, ratingGuestCommunication: 90,
      ratingPersonalHygiene: 90, ratingTeamwork: 90, ratingSpeed: 90,
    });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.score).toBeGreaterThan(SITE_AVERAGE);
  });

  it("PENDING reviews excluded — score stays at prior", async () => {
    await seedWaiterReview(waiterId, venueId, {
      status: "PENDING",
      ratingPunctuality: 0, ratingSkill: 0, ratingGuestCommunication: 0,
      ratingPersonalHygiene: 0, ratingTeamwork: 0, ratingSpeed: 0,
    });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.score).toBe(SITE_AVERAGE);
  });

  it("sanitaryBookValid=true adds 'sanitarna' badge", async () => {
    await dbRaw.waiterPassport.update({ where: { id: passportId }, data: { sanitaryBookValid: true } });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.badges).toContain("sanitarna");
  });

  it("totalEngagements >= 3 adds 'verified_history' badge", async () => {
    await dbRaw.waiterPassport.update({ where: { id: passportId }, data: { totalEngagements: 3 } });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.badges).toContain("verified_history");
  });

  it("totalEngagements < 3 does NOT add 'verified_history'", async () => {
    await dbRaw.waiterPassport.update({ where: { id: passportId }, data: { totalEngagements: 2 } });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.badges).not.toContain("verified_history");
  });

  it("totalEngagements >= 50 adds 'hospitality_pro' badge", async () => {
    await dbRaw.waiterPassport.update({ where: { id: passportId }, data: { totalEngagements: 50 } });
    await syncPassportScore(waiterId);
    const passport = await dbRaw.waiterPassport.findUnique({ where: { id: passportId } });
    expect(passport!.badges).toContain("hospitality_pro");
  });

  it("GUEST_TO_WAITER reviews counted separately from VENUE_TO_WAITER", async () => {
    await dbRaw.review.create({
      data: {
        subjectId:          waiterId,
        venueId,
        direction:          "GUEST_TO_WAITER",
        status:             "PUBLISHED",
        overallRating:      80,
        weight:             0.8,
        ratingFriendliness: 80,
        ratingGuestSpeed:   80,
        ratingAttentiveness:80,
      },
    });
    await syncPassportScore(waiterId);
    const score = await dbRaw.passportTrustScore.findUnique({ where: { passportId } });
    // guest reviews contribute to sampleSize via reviewCount = venueReviews.length + guestReviews.length
    expect(score!.sampleSize).toBe(1);
  });
});
