/**
 * Human-readable labels, icons and pickable options — the *data* half of what
 * used to be lib/formatting/display-maps.ts.
 *
 * Split out because the other half is Tailwind class strings, which mean nothing
 * in React Native. Labels, icons and option lists are identical on both clients
 * and must not be re-typed per app: a Serbian label that drifts between the web
 * dashboard and the phone is a bug users can see.
 *
 * Tailwind `*_COLORS` maps stay in apps/web and are NOT allowed here.
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


export const JOB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktivan",
  PAUSED: "Pauziran",
  FILLED: "Popunjen",
  CLOSED: "Zatvoren",
};

/* ── Invite status (PENDING | ACCEPTED | DECLINED | EXPIRED) ─────────────── */


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

/* ── Venue type ──────────────────────────────────────────────────────────── */
/**
 * Single source of truth for the VenueType taxonomy. Every picker, chip row and
 * icon must derive from these — do not hand-write another venue-type list.
 *
 * Three divergent copies previously existed (public venue filter, waiter passport
 * picker, two icon maps) and drifted: `NIGHT_CLUB` / `NIGHTCLUB` were offered in
 * the UI while absent from the enum, so selecting them matched nothing, and
 * `EVENT` was missing from the pickers entirely.
 *
 * Key order = enum order = picker order.
 */

export const VENUE_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restoran",
  CAFE:       "Kafić",
  BAR:        "Bar",
  NIGHT_CLUB: "Noćni klub",
  CATERING:   "Ketering",
  HOTEL:      "Hotel",
  EVENT:      "Event",
};


export const VENUE_TYPE_ICONS: Record<string, string> = {
  RESTAURANT: "🍽️",
  CAFE:       "☕",
  BAR:        "🍸",
  NIGHT_CLUB: "🎵",
  CATERING:   "🥂",
  HOTEL:      "🏨",
  EVENT:      "🎉",
};

/** Fallback for legacy/unknown venueType strings. */

export const VENUE_TYPE_ICON_FALLBACK = "🏢";

/** `{ value, label }` rows for `<select>` / chip pickers, in enum order. */

export const VENUE_TYPE_OPTIONS: { value: string; label: string }[] =
  Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

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


export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING:   "Na čekanju",
  APPROVED:  "Odobreno",
  REJECTED:  "Odbijeno",
  CANCELLED: "Otkazano",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}
