/**
 * Canonical passport-tier resolution.
 *
 * Always call at runtime — never cache tier in JWT.
 * subscriptionExpiresAt in the past → effective tier is FREE.
 */

export type PassportTier = "FREE" | "PRO" | "PRO_PLUS";

export interface PassportTierSource {
  passportTier: string;
  subscriptionExpiresAt: Date | null;
}

/**
 * Returns the effective tier for a WaiterPassport row, treating
 * expired subscriptions as FREE regardless of the stored `passportTier`.
 */
export function getEffectiveTier(passport: PassportTierSource | null | undefined): PassportTier {
  if (!passport) return "FREE";
  const { passportTier, subscriptionExpiresAt } = passport;
  if (passportTier === "FREE") return "FREE";
  const expired = subscriptionExpiresAt ? subscriptionExpiresAt <= new Date() : true;
  if (expired) return "FREE";
  return passportTier as PassportTier;
}

/**
 * PRO or PRO_PLUS with active subscription.
 * WhatsApp gating — requires isPro.
 */
export function isPro(passport: PassportTierSource | null | undefined): boolean {
  const tier = getEffectiveTier(passport);
  return tier === "PRO" || tier === "PRO_PLUS";
}

/**
 * PRO_PLUS with active subscription only.
 * SMS gating — requires isProPlus.
 */
export function isProPlus(passport: PassportTierSource | null | undefined): boolean {
  return getEffectiveTier(passport) === "PRO_PLUS";
}

/**
 * Numeric rank used for in-memory sort of waiter search results.
 * PRO_PLUS = 2, PRO = 1, FREE = 0.
 */
export function tierRank(passport: PassportTierSource | null | undefined): number {
  const tier = getEffectiveTier(passport);
  if (tier === "PRO_PLUS") return 2;
  if (tier === "PRO") return 1;
  return 0;
}
