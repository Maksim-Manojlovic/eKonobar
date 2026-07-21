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

/* ── Verification (UNVERIFIED | SILVER | GOLD | ID_VERIFIED) ──────────────── */
//
// These are *evidence sources*, not ranks. GOLD is not "better than" ID_VERIFIED
// — one means a venue owner vouched via invite code, the other means a government
// ID was checked. Never render them as a ladder (that was the old Bronze→Platinum
// display, which also mismapped: it had no key for UNVERIFIED or ID_VERIFIED and
// fell back to showing "BRONZE" for both).
//
// The user-facing question is binary — "is this a proven person?" — with the
// evidence named alongside. Performance is the separate 0–100 passport score.

/** True for any tier that represents actual verified evidence. */
export function isVerified(tier?: string | null): boolean {
  return !!tier && tier !== "UNVERIFIED";
}

/** What each verification value actually proves, in Serbian. */
export const VERIFICATION_LABELS: Record<string, string> = {
  ID_VERIFIED: "Lična karta",
  GOLD:        "Potvrdio lokal",
  SILVER:      "Ugovor potvrđen",
  UNVERIFIED:  "Neverifikovan",
};

export const VERIFICATION_TIER_COLORS: Record<string, string> = {
  ID_VERIFIED: "text-purple-700 bg-purple-50 border-purple-300",
  GOLD:        "text-amber-700  bg-amber-50  border-amber-300",
  SILVER:      "text-slate-600  bg-slate-50  border-slate-300",
  UNVERIFIED:  "text-neutral-500 bg-neutral-50 border-neutral-300",
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

/* ── Staff department (FOH | BOH) ────────────────────────────────────────── */
//
// The BOH surface only exists at venues with a kitchen — see hasKitchen() in
// lib/staff/positions.ts. Don't render a Kuhinja tab for a kafić.

export const DEPARTMENT_LABELS: Record<string, string> = {
  FOH: "Sala",
  BOH: "Kuhinja",
};

export const DEPARTMENT_COLORS: Record<string, string> = {
  FOH: "text-orange-700 bg-orange-50 border-orange-300",
  BOH: "text-teal-700   bg-teal-50   border-teal-300",
};

/* ── Staff position ──────────────────────────────────────────────────────── */
//
// Position → department mapping lives in lib/staff/positions.ts (it's logic,
// not display). This map is labels only.

export const POSITION_LABELS: Record<string, string> = {
  // FOH — Sala
  HEAD_WAITER:   "Šef sale",
  SENIOR_WAITER: "Iskusni konobar",
  WAITER:        "Konobar",
  BARTENDER:     "Šanker",
  BARISTA:       "Barista",
  SOMMELIER:     "Somelijer",
  HOST:          "Hostesa",
  RUNNER:        "Runner",

  // BOH — Kuhinja
  HEAD_CHEF:   "Šef kuhinje",
  SOUS_CHEF:   "Su-šef",
  LINE_COOK:   "Kuvar",
  GRILL_COOK:  "Roštiljdžija",
  PASTRY_CHEF: "Poslastičar",
  PREP_COOK:   "Pomoćni kuvar",
  DISHWASHER:  "Perač suđa",
};

/* ── Staff status (ACTIVE | SUSPENDED | ENDED) ───────────────────────────── */

export const STAFF_STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "Aktivan",
  SUSPENDED: "Suspendovan",
  ENDED:     "Više ne radi",
};

export const STAFF_STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "text-green-700   bg-green-50   border-green-300",
  SUSPENDED: "text-amber-700   bg-amber-50   border-amber-300",
  ENDED:     "text-neutral-500 bg-neutral-50 border-neutral-300",
};

/* ── Leave type (ANNUAL | SICK | UNPAID | PARENTAL | SPECIAL) ────────────── */

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL:   "Godišnji odmor",
  SICK:     "Bolovanje",
  UNPAID:   "Neplaćeno odsustvo",
  PARENTAL: "Roditeljsko odsustvo",
  SPECIAL:  "Plaćeno odsustvo",
};

/** Compact form for calendar cells and dense list rows. */
export const LEAVE_TYPE_SHORT: Record<string, string> = {
  ANNUAL:   "Odmor",
  SICK:     "Bolovanje",
  UNPAID:   "Neplaćeno",
  PARENTAL: "Roditeljsko",
  SPECIAL:  "Plaćeno",
};

export const LEAVE_TYPE_COLORS: Record<string, string> = {
  ANNUAL:   "text-orange-700 bg-orange-50 border-orange-300",
  SICK:     "text-rose-700   bg-rose-50   border-rose-300",
  UNPAID:   "text-slate-600  bg-slate-50  border-slate-300",
  PARENTAL: "text-violet-700 bg-violet-50 border-violet-300",
  SPECIAL:  "text-sky-700    bg-sky-50    border-sky-300",
};

/* ── Leave status (PENDING | APPROVED | REJECTED | CANCELLED) ────────────── */

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING:   "Na čekanju",
  APPROVED:  "Odobreno",
  REJECTED:  "Odbijeno",
  CANCELLED: "Otkazano",
};

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:   "text-amber-700   bg-amber-50   border-amber-300",
  APPROVED:  "text-green-700   bg-green-50   border-green-300",
  REJECTED:  "text-red-700     bg-red-50     border-red-300",
  CANCELLED: "text-neutral-500 bg-neutral-50 border-neutral-300",
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
