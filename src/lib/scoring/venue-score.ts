// ─── Venue trust score ────────────────────────────────────────────────────────
// Calculates Trust Score and per-dimension scores for venues,
// based on WAITER_TO_VENUE (and GUEST_TO_VENUE) reviews.

import type { Review } from "@prisma/client";
import {
  type WeightedScore,
  avgNonNull,
  normalize,
  toWeighted,
  bayesianAverage,
  clamp,
} from "./bayesian";

const PENALTY_VERIFIED_LIE        = 20;
const PENALTY_INAPPROPRIATE_REPLY = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Polja potrebna za računanje Trust Score lokala (WAITER_TO_VENUE recenzije).
 */
export type ReviewForVenueScore = Pick<
  Review,
  | "weight"
  | "createdAt"
  | "ratingAtmosphere"
  | "ratingOrganization"
  | "ratingPay"
  | "ratingTips"
  | "ratingHygieneWork"
  | "ratingManagement"
>;

export type PenaltyInput = {
  verifiedLieCount: number;
  inappropriateReplyCount: number;
};

/** Per-dimension score za TrustRadar komponentu. */
export interface VenueScoreDimensions {
  atmosphere:   number;
  organization: number;
  pay:          number;
  tips:         number;
  hygiene:      number;
  management:   number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Sirova ocena za WAITER_TO_VENUE recenziju (6 kategorija lokala)
function venueRawScore(r: ReviewForVenueScore): number | null {
  const avg = avgNonNull([
    r.ratingAtmosphere,
    r.ratingOrganization,
    r.ratingPay,
    r.ratingTips,
    r.ratingHygieneWork,
    r.ratingManagement,
  ]);
  return avg !== null ? normalize(avg) : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trust Score lokala na osnovu WAITER_TO_VENUE recenzija.
 * Ulaz: samo PUBLISHED recenzije sa direction === WAITER_TO_VENUE.
 */
export function calculateVenueTrustScore(
  reviews: ReviewForVenueScore[],
  penalties: PenaltyInput = { verifiedLieCount: 0, inappropriateReplyCount: 0 },
): number {
  const items = reviews
    .map((r) => toWeighted(r, venueRawScore(r)))
    .filter((ws): ws is WeightedScore => ws !== null);

  const base = bayesianAverage(items);
  const deduction =
    penalties.verifiedLieCount * PENALTY_VERIFIED_LIE +
    penalties.inappropriateReplyCount * PENALTY_INAPPROPRIATE_REPLY;

  return clamp(base - deduction);
}

/**
 * Per-dimension score lokala za TrustRadar komponentu.
 * Vraća prosek po svakoj od 6 dimenzija (Bayesian per-dimension).
 */
export function calculateVenueScoreDimensions(
  reviews: ReviewForVenueScore[],
): VenueScoreDimensions {
  const published = reviews.filter(
    (r) =>
      r.ratingAtmosphere !== null ||
      r.ratingOrganization !== null ||
      r.ratingPay !== null,
  );

  function dimAvg(getter: (r: ReviewForVenueScore) => number | null): number {
    const items = published
      .map((r) => toWeighted(r, getter(r)))
      .filter((ws): ws is WeightedScore => ws !== null);
    return clamp(bayesianAverage(items));
  }

  return {
    atmosphere:   dimAvg((r) => r.ratingAtmosphere),
    organization: dimAvg((r) => r.ratingOrganization),
    pay:          dimAvg((r) => r.ratingPay),
    tips:         dimAvg((r) => r.ratingTips),
    hygiene:      dimAvg((r) => r.ratingHygieneWork),
    management:   dimAvg((r) => r.ratingManagement),
  };
}
