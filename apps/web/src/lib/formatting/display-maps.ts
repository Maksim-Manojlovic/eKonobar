/**
 * Web display maps — Tailwind className strings for badges.
 *
 * The labels, icons and option lists this module also exports live in
 * @ekonobar/shared/formatting/labels, so the mobile app renders the exact same
 * Serbian strings. They are re-exported below, which is why every existing
 * importer of this module keeps working unchanged.
 *
 * Only Tailwind class strings belong in this file. Anything a React Native
 * screen would also need goes in the shared package instead.
 *
 * Naming convention:
 *   <ENTITY>_<FIELD>_COLORS  — Tailwind className strings (here)
 *   <ENTITY>_<FIELD>_LABELS  — Human-readable Serbian labels (shared)
 */
// The labels, icons and option lists live in @ekonobar/shared so the mobile app
// renders the exact same Serbian strings — re-exported here so every existing
// importer of this module keeps working unchanged.
//
// What stays below is only the Tailwind class strings, which are web-only.
export * from "@ekonobar/shared/formatting/labels";


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


export const JOB_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-green-700   bg-green-50   border-green-300",
  PAUSED: "text-amber-700   bg-amber-50   border-amber-300",
  FILLED: "text-blue-700    bg-blue-50    border-blue-300",
  CLOSED: "text-neutral-500 bg-neutral-50 border-neutral-300",
};


export const INVITE_STATUS_COLORS: Record<string, string> = {
  PENDING:  "text-amber-700   bg-amber-50   border-amber-300",
  ACCEPTED: "text-green-700   bg-green-50   border-green-300",
  DECLINED: "text-neutral-500 bg-neutral-50 border-neutral-300",
  EXPIRED:  "text-red-500     bg-red-50     border-red-200",
};


export const DEPARTMENT_COLORS: Record<string, string> = {
  FOH: "text-orange-700 bg-orange-50 border-orange-300",
  BOH: "text-teal-700   bg-teal-50   border-teal-300",
};

/* ── Staff position ──────────────────────────────────────────────────────── */


export const STAFF_STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "text-green-700   bg-green-50   border-green-300",
  SUSPENDED: "text-amber-700   bg-amber-50   border-amber-300",
  ENDED:     "text-neutral-500 bg-neutral-50 border-neutral-300",
};

/* ── Leave type (ANNUAL | SICK | UNPAID | PARENTAL | SPECIAL) ────────────── */


export const LEAVE_TYPE_COLORS: Record<string, string> = {
  ANNUAL:   "text-orange-700 bg-orange-50 border-orange-300",
  SICK:     "text-rose-700   bg-rose-50   border-rose-300",
  UNPAID:   "text-slate-600  bg-slate-50  border-slate-300",
  PARENTAL: "text-violet-700 bg-violet-50 border-violet-300",
  SPECIAL:  "text-sky-700    bg-sky-50    border-sky-300",
};

/* ── Leave status (PENDING | APPROVED | REJECTED | CANCELLED) ────────────── */


export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:   "text-amber-700   bg-amber-50   border-amber-300",
  APPROVED:  "text-green-700   bg-green-50   border-green-300",
  REJECTED:  "text-red-700     bg-red-50     border-red-300",
  CANCELLED: "text-neutral-500 bg-neutral-50 border-neutral-300",
};

/* ── Date formatting — Serbian locale ────────────────────────────────────── */

/** Formats ISO date string → "15. maj 2025." in Serbian locale. */
