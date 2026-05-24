// Runtime display constants for the Waiter dashboard.
// Import types from ./waiter-types — never the reverse.
// No JSX — safe to import in both client and server contexts.

import type { PassportData, Section } from "./waiter-types";

/* ── Shared type ─────────────────────────────────────────────────────────── */

export type BadgeProgress = { current: number; total: number; unit: string };

/* ── Tier helpers ────────────────────────────────────────────────────────── */

export const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  BRONZE:   { label: "BRONZE",      cls: "bg-orange-100 text-orange-700" },
  SILVER:   { label: "SILVER",      cls: "bg-neutral-200 text-neutral-600" },
  GOLD:     { label: "🥇 GOLD",     cls: "bg-amber-100 text-amber-700" },
  PLATINUM: { label: "💎 PLATINUM", cls: "bg-blue-100 text-blue-700" },
};

export const NEXT_TIER: Record<string, string | null> = {
  BRONZE: "SILVER", SILVER: "GOLD", GOLD: "PLATINUM", PLATINUM: null,
};

/* ── Passport badge metadata ─────────────────────────────────────────────── */

export const BADGE_META: Record<string, { emoji: string; label: string; sub: string }> = {
  sanitarna:        { emoji: "🧪", label: "Sanitarna knjižica", sub: "Verifikovan dokument" },
  sommelier:        { emoji: "🍷", label: "Somelijer",           sub: "Kurs završen" },
  english_b2:       { emoji: "🌍", label: "Engleski B2",         sub: "Jezik potvrđen" },
  verified_history: { emoji: "📋", label: "Verified History",    sub: "3+ verifikovane smene" },
  hospitality_pro:  { emoji: "🏅", label: "Hospitality Pro",     sub: "50 smena potrebno" },
  platinum:         { emoji: "💎", label: "Platinum Waiter",     sub: "Skor 98+ potreban" },
};

/* ── Badge progress functions (named so they are individually testable) ─── */

export function verifiedHistoryProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(p.totalEngagements, 3), total: 3, unit: "smena" };
}

export function hospitalityProProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(p.totalEngagements, 50), total: 50, unit: "smena" };
}

export function platinumProgress(p: PassportData): BadgeProgress {
  return { current: Math.min(Math.round(p.score), 98), total: 98, unit: "skor" };
}

export const BADGE_PROGRESS: Record<string, ((p: PassportData) => BadgeProgress) | null> = {
  verified_history: verifiedHistoryProgress,
  hospitality_pro:  hospitalityProProgress,
  platinum:         platinumProgress,
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
  invites:       "Pozivnice",
  reviews:       "Recenzije",
  passport:      "Waiter Passport™",
  manage:        "Šef konobara",
  notifications: "Obaveštenja",
};
