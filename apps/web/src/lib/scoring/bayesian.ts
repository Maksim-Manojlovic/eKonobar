// ─── Bayesian scoring core ────────────────────────────────────────────────────
// Pure math layer — no domain types, no Prisma imports.
// Imported by venue-score.ts and passport-score.ts.

export const SITE_AVERAGE = 65;

const BAYESIAN_MIN_VOTES  = 5;
const DECAY_SOFT_MONTHS   = 24; // -30% uticaja
const DECAY_HARD_MONTHS   = 48; // -50% uticaja

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeightedScore = { score: number; effectiveWeight: number };

// ─── Internal primitives ──────────────────────────────────────────────────────

export function avgNonNull(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Ocene su već 0-100 integeri — normalizacija nije potrebna
export function normalize(rating: number): number {
  return rating;
}

// Faktor svežine: ocene starije od 24m gube 30%, starije od 48m gube 50%
export function decayMultiplier(createdAt: Date): number {
  const ageMonths =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (ageMonths > DECAY_HARD_MONTHS) return 0.5;
  if (ageMonths > DECAY_SOFT_MONTHS) return 0.7;
  return 1.0;
}

export function toWeighted<T extends { weight: number; createdAt: Date }>(
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
export function bayesianAverage(items: WeightedScore[]): number {
  if (items.length === 0) return SITE_AVERAGE;

  const totalWeight  = items.reduce((sum, i) => sum + i.effectiveWeight, 0);
  const weightedSum  = items.reduce((sum, i) => sum + i.score * i.effectiveWeight, 0);
  const R = weightedSum / totalWeight;

  return (
    (totalWeight * R + BAYESIAN_MIN_VOTES * SITE_AVERAGE) /
    (totalWeight + BAYESIAN_MIN_VOTES)
  );
}

export function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Public scoring utilities ─────────────────────────────────────────────────

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
