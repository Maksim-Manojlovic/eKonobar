import type { Review } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SITE_AVERAGE = 65;
const BAYESIAN_MIN_VOTES = 5;

const DECAY_SOFT_MONTHS = 24; // -30% uticaja
const DECAY_HARD_MONTHS = 48; // -50% uticaja

const PENALTY_VERIFIED_LIE = 20;
const PENALTY_INAPPROPRIATE_REPLY = 10;

// ─── Input types ──────────────────────────────────────────────────────────────

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

export type PenaltyInput = {
  verifiedLieCount: number;
  inappropriateReplyCount: number;
};

// ─── Per-dimension score (za TrustRadar komponentu) ──────────────────────────

export interface VenueScoreDimensions {
  atmosphere: number;
  organization: number;
  pay: number;
  tips: number;
  hygiene: number;
  management: number;
}

export interface PassportScoreDimensions {
  punctuality: number;
  skill: number;
  communication: number;
  hygiene: number;
  teamwork: number;
  speed: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function avgNonNull(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Ocene su već 0-100 integeri — normalizacija nije potrebna
function normalize(rating: number): number {
  return rating;
}

// Faktor svežine: ocene starije od 24m gube 30%, starije od 48m gube 50%
function decayMultiplier(createdAt: Date): number {
  const ageMonths =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (ageMonths > DECAY_HARD_MONTHS) return 0.5;
  if (ageMonths > DECAY_SOFT_MONTHS) return 0.7;
  return 1.0;
}

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

// Sirova ocena za GUEST_TO_WAITER recenziju (3 gostinske kategorije)
// Gostinska recenzija ima manji broj dimenzija —
// weight je već niži zbog geofencing verifikacije (bez ID_VERIFIED množitelja)
function waiterGuestRawScore(r: ReviewForPassportScore): number | null {
  const avg = avgNonNull([
    r.ratingFriendliness,
    r.ratingGuestSpeed,
    r.ratingAttentiveness,
  ]);
  return avg !== null ? normalize(avg) : null;
}

type WeightedScore = { score: number; effectiveWeight: number };

function toWeighted<T extends { weight: number; createdAt: Date }>(
  r: T,
  raw: number | null,
): WeightedScore | null {
  if (raw === null) return null;
  return {
    score: raw,
    effectiveWeight: r.weight * decayMultiplier(r.createdAt),
  };
}

// Bayesian average — štiti od malog broja uzoraka (kao Amazon/IMDb)
// B = (Σweight * R + m * C) / (Σweight + m)
function bayesianAverage(items: WeightedScore[]): number {
  if (items.length === 0) return SITE_AVERAGE;

  const totalWeight = items.reduce((sum, i) => sum + i.effectiveWeight, 0);
  const weightedSum = items.reduce(
    (sum, i) => sum + i.score * i.effectiveWeight,
    0,
  );
  const R = weightedSum / totalWeight;

  return (
    (totalWeight * R + BAYESIAN_MIN_VOTES * SITE_AVERAGE) /
    (totalWeight + BAYESIAN_MIN_VOTES)
  );
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
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

/**
 * "High Friction" detekcija — konobar i lokal imaju drastično različite ocene.
 * Sistem šalje na moderaciju ako je razlika >= threshold (default 60 poena).
 *
 * Napomena: GUEST_TO_WAITER recenzije ne učestvuju u High Friction detekciji —
 * gosti ne ocenjuju lokal, nema parovanog review-a za poređenje.
 */
export function isHighFriction(
  waiterScore: number,
  venueScore: number,
  threshold = 60,
): boolean {
  return Math.abs(waiterScore - venueScore) >= threshold;
}

/**
 * Helper za brzu normalizaciju sirovih ocena u POST /api/reviews
 * pre High Friction provere (identičan kao u originalnom RentCheck).
 */
export function quickScore(ratings: (number | null | undefined)[]): number {
  const valid = ratings.filter((v): v is number => v != null);
  if (valid.length === 0) return 50;
  // Ocene su 0-100 integeri — direktni prosek (ne ×20 konverzija, to je na klijentu)
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
