import { describe, it, expect } from "vitest";
import {
  calculateVenueTrustScore,
  calculatePassportScore,
  calculateVenueScoreDimensions,
  calculatePassportScoreDimensions,
  isHighFriction,
  quickScore,
  SITE_AVERAGE,
  type ReviewForVenueScore,
  type ReviewForPassportScore,
} from "../trust-score";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RECENT = new Date(); // no decay

function venueReview(rating: number, weight = 1.0): ReviewForVenueScore {
  return {
    weight,
    createdAt: RECENT,
    ratingAtmosphere:   rating,
    ratingOrganization: rating,
    ratingPay:          rating,
    ratingTips:         rating,
    ratingHygieneWork:  rating,
    ratingManagement:   rating,
  };
}

function waiterReview(rating: number, weight = 1.0): ReviewForPassportScore {
  return {
    weight,
    createdAt: RECENT,
    ratingPunctuality:        rating,
    ratingSkill:              rating,
    ratingGuestCommunication: rating,
    ratingPersonalHygiene:    rating,
    ratingTeamwork:           rating,
    ratingSpeed:              rating,
    ratingFriendliness:       null,
    ratingGuestSpeed:         null,
    ratingAttentiveness:      null,
  };
}

function guestReview(rating: number, weight = 0.8): ReviewForPassportScore {
  return {
    weight,
    createdAt: RECENT,
    ratingPunctuality:        null,
    ratingSkill:              null,
    ratingGuestCommunication: null,
    ratingPersonalHygiene:    null,
    ratingTeamwork:           null,
    ratingSpeed:              null,
    ratingFriendliness:       rating,
    ratingGuestSpeed:         rating,
    ratingAttentiveness:      rating,
  };
}

// ── calculateVenueTrustScore ──────────────────────────────────────────────────

describe("calculateVenueTrustScore", () => {
  it("returns SITE_AVERAGE with no reviews (Bayesian prior)", () => {
    expect(calculateVenueTrustScore([])).toBe(SITE_AVERAGE);
  });

  it("pulls score toward review value as reviews accumulate", () => {
    const high = [80, 80, 80, 80, 80].map(r => venueReview(r));
    const low  = [20, 20, 20, 20, 20].map(r => venueReview(r));

    const highScore = calculateVenueTrustScore(high);
    const lowScore  = calculateVenueTrustScore(low);

    expect(highScore).toBeGreaterThan(SITE_AVERAGE);
    expect(lowScore).toBeLessThan(SITE_AVERAGE);
  });

  it("with many high reviews, score converges near the review value", () => {
    const reviews = Array.from({ length: 20 }, () => venueReview(90));
    const score = calculateVenueTrustScore(reviews);
    expect(score).toBeGreaterThan(80);
  });

  it("single review stays closer to prior than to review value", () => {
    const score = calculateVenueTrustScore([venueReview(100)]);
    // One review shouldn't push score all the way to 100
    expect(score).toBeLessThan(85);
    expect(score).toBeGreaterThan(SITE_AVERAGE);
  });

  it("penalties reduce score", () => {
    const reviews = Array.from({ length: 10 }, () => venueReview(80));
    const base    = calculateVenueTrustScore(reviews);
    const penalized = calculateVenueTrustScore(reviews, {
      verifiedLieCount: 2,
      inappropriateReplyCount: 1,
    });
    expect(penalized).toBeLessThan(base);
    // verifiedLie=2 (-40) + inappropriateReply=1 (-10) = -50 max
    expect(base - penalized).toBeLessThanOrEqual(50);
  });

  it("clamps score to 0-100", () => {
    const reviews = Array.from({ length: 10 }, () => venueReview(0));
    const score = calculateVenueTrustScore(reviews, {
      verifiedLieCount: 10,
      inappropriateReplyCount: 10,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("ID_VERIFIED reviews (weight 1.2) have more influence than unverified (weight 1.0)", () => {
    // Mix: 5 low-weight reviews at 0, 1 high-weight review at 100
    const lowWeightLow   = Array.from({ length: 5 }, () => venueReview(0, 1.0));
    const highWeightHigh = [venueReview(100, 1.2)];
    const mixedScore = calculateVenueTrustScore([...lowWeightLow, ...highWeightHigh]);

    // Same mix but equal weights — high-weight review should pull score higher
    const lowWeightHigh  = [venueReview(100, 1.0)];
    const equalScore = calculateVenueTrustScore([...lowWeightLow, ...lowWeightHigh]);

    expect(mixedScore).toBeGreaterThan(equalScore);
  });
});

// ── calculatePassportScore ────────────────────────────────────────────────────

describe("calculatePassportScore", () => {
  it("returns SITE_AVERAGE with no reviews", () => {
    expect(calculatePassportScore([], [])).toBe(SITE_AVERAGE);
  });

  it("venue reviews move score up", () => {
    const reviews = Array.from({ length: 5 }, () => waiterReview(90));
    expect(calculatePassportScore(reviews, [])).toBeGreaterThan(SITE_AVERAGE);
  });

  it("guest reviews contribute to score", () => {
    const venueOnly  = calculatePassportScore(Array.from({ length: 5 }, () => waiterReview(80)), []);
    const withGuests = calculatePassportScore(
      Array.from({ length: 5 }, () => waiterReview(80)),
      Array.from({ length: 5 }, () => guestReview(80)),
    );
    // More data → converges more, both should be above site average
    expect(withGuests).toBeGreaterThan(SITE_AVERAGE);
    expect(venueOnly).toBeGreaterThan(SITE_AVERAGE);
  });

  it("low guest reviews pull score down", () => {
    const highVenue = Array.from({ length: 5 }, () => waiterReview(90));
    const withHighGuests = calculatePassportScore(highVenue, Array.from({ length: 10 }, () => guestReview(90)));
    const withLowGuests  = calculatePassportScore(highVenue, Array.from({ length: 10 }, () => guestReview(10)));
    expect(withHighGuests).toBeGreaterThan(withLowGuests);
  });
});

// ── calculateVenueScoreDimensions ─────────────────────────────────────────────

describe("calculateVenueScoreDimensions", () => {
  it("all dimensions return values in 0-100 range", () => {
    const reviews = Array.from({ length: 5 }, () => venueReview(75));
    const dims = calculateVenueScoreDimensions(reviews);
    for (const val of Object.values(dims)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("returns all dimension keys", () => {
    const dims = calculateVenueScoreDimensions([]);
    expect(Object.keys(dims)).toEqual(["atmosphere", "organization", "pay", "tips", "hygiene", "management"]);
  });
});

// ── calculatePassportScoreDimensions ──────────────────────────────────────────

describe("calculatePassportScoreDimensions", () => {
  it("all dimensions return values in 0-100 range", () => {
    const reviews = Array.from({ length: 5 }, () => waiterReview(80));
    const dims = calculatePassportScoreDimensions(reviews);
    for (const val of Object.values(dims)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("returns all dimension keys", () => {
    const dims = calculatePassportScoreDimensions([]);
    expect(Object.keys(dims)).toEqual(["punctuality", "skill", "communication", "hygiene", "teamwork", "speed"]);
  });
});

// ── isHighFriction ────────────────────────────────────────────────────────────

describe("isHighFriction", () => {
  it("detects friction at >= 60 diff (default threshold)", () => {
    expect(isHighFriction(80, 10)).toBe(true);
    expect(isHighFriction(10, 80)).toBe(true);
  });

  it("no friction below threshold", () => {
    expect(isHighFriction(70, 30)).toBe(false); // diff = 40
    expect(isHighFriction(65, 65)).toBe(false);
  });

  it("exactly at threshold is high friction", () => {
    expect(isHighFriction(90, 30)).toBe(true); // diff = 60
  });

  it("custom threshold works", () => {
    expect(isHighFriction(70, 60, 5)).toBe(true);  // diff = 10 >= 5
    expect(isHighFriction(70, 65, 10)).toBe(false); // diff = 5 < 10
  });
});

// ── quickScore ────────────────────────────────────────────────────────────────

describe("quickScore", () => {
  it("returns 50 for empty input", () => {
    expect(quickScore([])).toBe(50);
  });

  it("averages numeric values", () => {
    expect(quickScore([80, 60])).toBe(70);
    expect(quickScore([100])).toBe(100);
  });

  it("ignores null and undefined", () => {
    expect(quickScore([80, null, undefined, 60])).toBe(70);
    expect(quickScore([null, null])).toBe(50);
  });
});
