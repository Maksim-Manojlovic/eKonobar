// ─── Passport (waiter) trust score ───────────────────────────────────────────
// Calculates Passport Score and per-dimension scores for waiters,
// based on VENUE_TO_WAITER and GUEST_TO_WAITER reviews.

import type { Review } from "@prisma/client";
import {
  type WeightedScore,
  avgNonNull,
  normalize,
  toWeighted,
  bayesianAverage,
  clamp,
} from "./bayesian";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Polja potrebna za računanje Passport Score konobara.
 * Uključuje VENUE_TO_WAITER i GUEST_TO_WAITER recenzije —
 * guest kategorije imaju manji broj dimenzija ali ulaze u isti Bayesian pool.
 */
export type ReviewForPassportScore = Pick<
  Review,
  | "weight"
  | "createdAt"
  | "ratingPunctuality"
  | "ratingSkill"
  | "ratingGuestCommunication"
  | "ratingPersonalHygiene"
  | "ratingTeamwork"
  | "ratingSpeed"
  | "ratingFriendliness"
  | "ratingGuestSpeed"
  | "ratingAttentiveness"
>;

/** Per-dimension score za TrustRadar komponentu. */
export interface PassportScoreDimensions {
  punctuality:   number;
  skill:         number;
  communication: number;
  hygiene:       number;
  teamwork:      number;
  speed:         number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Sirova ocena za VENUE_TO_WAITER recenziju (6 profesionalnih kategorija)
function waiterProfessionalRawScore(r: ReviewForPassportScore): number | null {
  const avg = avgNonNull([
    r.ratingPunctuality,
    r.ratingSkill,
    r.ratingGuestCommunication,
    r.ratingPersonalHygiene,
    r.ratingTeamwork,
    r.ratingSpeed,
  ]);
  return avg !== null ? normalize(avg) : null;
}

// Sirova ocena za GUEST_TO_WAITER recenziju (3 gostinske kategorije).
// Gostinska recenzija ima manji broj dimenzija —
// weight je već niži zbog geofencing verifikacije (bez ID_VERIFIED množitelja).
function waiterGuestRawScore(r: ReviewForPassportScore): number | null {
  const avg = avgNonNull([
    r.ratingFriendliness,
    r.ratingGuestSpeed,
    r.ratingAttentiveness,
  ]);
  return avg !== null ? normalize(avg) : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Waiter Passport Score na osnovu VENUE_TO_WAITER i GUEST_TO_WAITER recenzija.
 *
 * Oba tipa recenzije ulaze u isti Bayesian pool —
 * gostinske recenzije imaju niži weight (0.6) jer nemaju invite verifikaciju,
 * ali su geofencing-verified pa nisu potpuno bez vrednosti.
 *
 * Ulaz: PUBLISHED recenzije oba direction-a za jednog konobara.
 */
export function calculatePassportScore(
  venueReviews: ReviewForPassportScore[],
  guestReviews: ReviewForPassportScore[],
): number {
  const venueItems = venueReviews
    .map((r) => toWeighted(r, waiterProfessionalRawScore(r)))
    .filter((ws): ws is WeightedScore => ws !== null);

  const guestItems = guestReviews
    .map((r) => toWeighted(r, waiterGuestRawScore(r)))
    .filter((ws): ws is WeightedScore => ws !== null);

  return clamp(bayesianAverage([...venueItems, ...guestItems]));
}

/**
 * Per-dimension score konobara za TrustRadar komponentu.
 * Gostinske kategorije (friendliness, guestSpeed, attentiveness) se prikazuju
 * odvojeno u "Utisak gostiju" sekciji Passport stranice.
 */
export function calculatePassportScoreDimensions(
  venueReviews: ReviewForPassportScore[],
): PassportScoreDimensions {
  function dimAvg(getter: (r: ReviewForPassportScore) => number | null): number {
    const items = venueReviews
      .map((r) => toWeighted(r, getter(r)))
      .filter((ws): ws is WeightedScore => ws !== null);
    return clamp(bayesianAverage(items));
  }

  return {
    punctuality:   dimAvg((r) => r.ratingPunctuality),
    skill:         dimAvg((r) => r.ratingSkill),
    communication: dimAvg((r) => r.ratingGuestCommunication),
    hygiene:       dimAvg((r) => r.ratingPersonalHygiene),
    teamwork:      dimAvg((r) => r.ratingTeamwork),
    speed:         dimAvg((r) => r.ratingSpeed),
  };
}
