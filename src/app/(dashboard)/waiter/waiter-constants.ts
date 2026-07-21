// Runtime display constants for the Waiter dashboard.
// Import types from ./waiter-types — never the reverse.
// No JSX — safe to import in both client and server contexts.

import type { PassportData, Section } from "./waiter-types";

/* ── Shared type ─────────────────────────────────────────────────────────── */

export type BadgeProgress = { current: number; total: number; unit: string };

/* ── Next verification step ──────────────────────────────────────────────── */
//
// Replaces the old TIER_BADGE / NEXT_TIER metal ladder (BRONZE→PLATINUM). That
// ladder never matched the DB: VerificationTier is UNVERIFIED | SILVER | GOLD |
// ID_VERIFIED, so BRONZE and PLATINUM were unreachable while UNVERIFIED and
// ID_VERIFIED had no entry and fell back to rendering "BRONZE".
//
// Verification is now shown as a binary badge (<VerifiedBadge />) plus the named
// evidence. What a waiter needs is not "the next metal" but the next concrete
// action, which is what this map holds.

export const NEXT_VERIFICATION_STEP: Record<string, string | null> = {
  UNVERIFIED:  "Potvrdi identitet ličnom kartom da dobiješ oznaku Verifikovan",
  SILVER:      "Zatraži invite kod od lokala u kojem radiš",
  GOLD:        "Potvrdi identitet ličnom kartom — tvoje ocene tada nose veću težinu",
  ID_VERIFIED: null,
};

/* ── Passport badge metadata ─────────────────────────────────────────────── */

export const BADGE_META: Record<string, { emoji: string; label: string; sub: string }> = {
  sanitarna:        { emoji: "🧪", label: "Sanitarna knjižica", sub: "Verifikovan dokument" },
  sommelier:        { emoji: "🍷", label: "Somelijer",           sub: "Kurs završen" },
  english_b2:       { emoji: "🌍", label: "Engleski B2",         sub: "Jezik potvrđen" },
  verified_history: { emoji: "📋", label: "Verifikovana istorija", sub: "3+ verifikovane smene" },
  hospitality_pro:  { emoji: "🏅", label: "Hospitality Pro",     sub: "50 smena potrebno" },
  elite:            { emoji: "⭐", label: "Elitni konobar",      sub: "Skor 98+ potreban" },
};

/* ── Badge progress functions (named so they are individually testable) ─── */

export function verifiedHistoryProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(p.totalEngagements, 3), total: 3, unit: "smena" };
}

export function hospitalityProProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(p.totalEngagements, 50), total: 50, unit: "smena" };
}

export function eliteProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(Math.round(p.score), 98), total: 98, unit: "skor" };
}

export const BADGE_PROGRESS: Record<string, ((p: PassportData) => BadgeProgress) | null> = {
  verified_history: verifiedHistoryProgress,
  hospitality_pro:  hospitalityProProgress,
  elite:            eliteProgress,
  sanitarna:        null,
  sommelier:        null,
  english_b2:       null,
};

/* ── Passport form options ───────────────────────────────────────────────── */

export const VENUE_TYPE_OPTIONS = [
  { value: "RESTAURANT", label: "Restoran" },
  { value: "CAFE",       label: "Kafić" },
  { value: "BAR",        label: "Bar" },
  { value: "NIGHT_CLUB", label: "Noćni klub" },
  { value: "HOTEL",      label: "Hotel" },
  { value: "CATERING",   label: "Ketering" },
];

export const SCORE_DIMS: { key: keyof NonNullable<PassportData["trustScore"]>; label: string }[] = [
  { key: "punctuality",        label: "Tačnost" },
  { key: "skill",              label: "Veštine" },
  { key: "guestCommunication", label: "Komunikacija" },
  { key: "personalHygiene",    label: "Higijena" },
  { key: "teamwork",           label: "Tim" },
  { key: "speed",              label: "Brzina" },
];

/* ── Navigation ──────────────────────────────────────────────────────────── */

export const SECTION_TITLES: Record<Section, string> = {
  overview:      "Pregled",
  alerts:        "Red Alert",
  jobs:          "Dostupni poslovi",
  applications:  "Moje prijave",
  shifts:        "Smene",
  odmori:        "Odmori",
  invites:       "Pozivnice",
  reviews:       "Recenzije",
  passport:      "Waiter Passport™",
  manage:        "Šef konobara",
  notifications: "Obaveštenja",
};
