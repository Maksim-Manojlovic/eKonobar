/**
 * Shared display constants for badge colors, status labels, and date formatting.
 *
 * Single source of truth — eliminates the ~12 duplicated local copies that
 * previously lived inline in individual dashboard page files.
 *
 * Naming convention:
 *   <ENTITY>_<FIELD>_COLORS  — Tailwind className strings for badge backgrounds/borders
 *   <ENTITY>_<FIELD>_LABELS  — Human-readable Serbian labels
 */

/* ── Verification tier (UNVERIFIED | SILVER | GOLD | ID_VERIFIED) ─────────── */

export const VERIFICATION_TIER_COLORS: Record<string, string> = {
  ID_VERIFIED: "text-purple-700 bg-purple-50 border-purple-300",
  GOLD:        "text-amber-700  bg-amber-50  border-amber-300",
  SILVER:      "text-slate-600  bg-slate-50  border-slate-300",
  UNVERIFIED:  "text-neutral-500 bg-neutral-50 border-neutral-300",
};

/* ── Passport subscription tier (FREE | PRO | PRO_PLUS) — dark-bg variant ── */

export const PASSPORT_TIER_COLORS: Record<string, string> = {
  FREE:     "text-white/40 bg-white/5",
  PRO:      "text-orange-400 bg-orange-500/15",
  PRO_PLUS: "text-amber-300 bg-amber-500/15",
};

/* ── Job application status ──────────────────────────────────────────────── */

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  PENDING:     "text-amber-700 bg-amber-50 border-amber-300",
  SHORTLISTED: "text-blue-700  bg-blue-50  border-blue-200",
  ACCEPTED:    "text-green-700 bg-green-50 border-green-300",
  COMPLETED:   "text-green-700 bg-green-50 border-green-300",
  REJECTED:    "text-red-700   bg-red-50   border-red-300",
  WITHDRAWN:   "text-neutral-500 bg-neutral-50 border-neutral-300",
};

/** Venue-owner perspective: "Na čekanju" (waiting on a decision) */
export const APPLICATION_STATUS_LABELS_VENUE: Record<string, string> = {
  PENDING:     "Na čekanju",
  SHORTLISTED: "Shortlist",
  ACCEPTED:    "Prihvaćeno",
  REJECTED:    "Odbijeno",
  COMPLETED:   "Završeno",
  WITHDRAWN:   "Povučena",
};

/** Waiter perspective: "Prijavljeno" (I applied) */
export const APPLICATION_STATUS_LABELS_WAITER: Record<string, string> = {
  PENDING:     "Prijavljeno",
  SHORTLISTED: "Shortlist",
  ACCEPTED:    "Prihvaćeno",
  REJECTED:    "Odbijeno",
  COMPLETED:   "Završeno",
  WITHDRAWN:   "Povučena",
};

/* ── Job post status (ACTIVE | PAUSED | FILLED | CLOSED) ─────────────────── */

export const JOB_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-green-700   bg-green-50   border-green-300",
  PAUSED: "text-amber-700   bg-amber-50   border-amber-300",
  FILLED: "text-blue-700    bg-blue-50    border-blue-300",
  CLOSED: "text-neutral-500 bg-neutral-50 border-neutral-300",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktivan",
  PAUSED: "Pauziran",
  FILLED: "Popunjen",
  CLOSED: "Zatvoren",
};

/* ── Invite status (PENDING | ACCEPTED | DECLINED | EXPIRED) ─────────────── */

export const INVITE_STATUS_COLORS: Record<string, string> = {
  PENDING:  "text-amber-700   bg-amber-50   border-amber-300",
  ACCEPTED: "text-green-700   bg-green-50   border-green-300",
  DECLINED: "text-neutral-500 bg-neutral-50 border-neutral-300",
  EXPIRED:  "text-red-500     bg-red-50     border-red-200",
};

export const INVITE_STATUS_LABELS: Record<string, string> = {
  PENDING:  "Na čekanju",
  ACCEPTED: "Prihvaćena",
  DECLINED: "Odbijena",
  EXPIRED:  "Istekla",
};

/* ── Engagement type (FULL_TIME | SEASONAL | WEEKEND | CELEBRATION) ─────── */

export const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME:   "Stalno",
  SEASONAL:    "Sezonski",
  WEEKEND:     "Vikend",
  CELEBRATION: "Slavlje",
};

/* ── Venue type (RESTAURANT | CAFE | BAR | CATERING | HOTEL | EVENT) ─────── */

export const VENUE_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restoran",
  CAFE:       "Kafić",
  BAR:        "Bar",
  CATERING:   "Ketering",
  HOTEL:      "Hotel",
  EVENT:      "Event",
};

/* ── Review direction (WAITER_TO_VENUE | VENUE_TO_WAITER | GUEST_TO_WAITER | GUEST_TO_VENUE) ── */

export const DIRECTION_LABELS: Record<string, string> = {
  WAITER_TO_VENUE: "Konobar → Lokal",
  VENUE_TO_WAITER: "Lokal → Konobar",
  GUEST_TO_WAITER: "Gost → Konobar",
  GUEST_TO_VENUE:  "Gost → Lokal",
};

/* ── User role (WAITER | VENUE_OWNER | HEADHUNTER | ADMIN) ──────────────── */

export const ROLE_LABELS: Record<string, string> = {
  WAITER:      "Konobar",
  VENUE_OWNER: "Vlasnik",
  HEADHUNTER:  "Headhunter",
  ADMIN:       "Admin",
};

/* ── Date formatting — Serbian locale ────────────────────────────────────── */

/** Formats ISO date string → "15. maj 2025." in Serbian locale. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}
