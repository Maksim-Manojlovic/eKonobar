// Runtime display constants for the Venue dashboard.
// Import types from ./venue-types — never the reverse.
// No JSX — safe to import in both client and server contexts.

import type { Section, VenueReview } from "./venue-types";

/* ── Reviews ─────────────────────────────────────────────────────────────── */

/** Dimension labels for WAITER_TO_VENUE reviews (0-100 scale). */
export const VENUE_DIM_LABELS: ReadonlyArray<{
  key: keyof Pick<VenueReview, "ratingAtmosphere" | "ratingOrganization" | "ratingPay" | "ratingTips" | "ratingHygieneWork" | "ratingManagement">;
  label: string;
}> = [
  { key: "ratingAtmosphere",   label: "Atmosfera" },
  { key: "ratingOrganization", label: "Organizacija" },
  { key: "ratingPay",          label: "Plata" },
  { key: "ratingTips",         label: "Napojnice" },
  { key: "ratingHygieneWork",  label: "Higijena" },
  { key: "ratingManagement",   label: "Menadžment" },
];

/* ── Navigation ──────────────────────────────────────────────────────────── */

export const SECTION_TITLES: Record<Section, string> = {
  overview:      "Pregled",
  posts:         "Oglasi",
  "new-post":    "Novi oglas",
  smene:         "Smene",
  tim:           "Osoblje",
  odmori:        "Odmori",
  applications:  "Prijave",
  waiters:       "Konobari",
  discover:      "Pronađi konobara",
  reviews:       "Recenzije",
  "qr-review":   "QR Recenzije",
  analitika:     "Analitika konobara",
  profile:       "Profil lokala",
  notifications: "Obaveštenja",
};

/* ── Analytics ───────────────────────────────────────────────────────────── */

/** Period filter chips for the waiter-analytics section. */
export const ANALYTICS_PERIODS: ReadonlyArray<{ value: 7 | 30 | 90; label: string }> = [
  { value: 7,  label: "7 dana"  },
  { value: 30, label: "30 dana" },
  { value: 90, label: "90 dana" },
];

/** Red-flag chip styling per flag kind. */
export const FLAG_STYLES: Record<string, { label: string; cls: string }> = {
  NO_SHOWS:          { label: "Nedolasci",        cls: "bg-red-100 text-red-700" },
  LATE_CANCELS:      { label: "Kasni otkazi",     cls: "bg-orange-100 text-orange-700" },
  SWAP_CHURN:        { label: "Zamene",           cls: "bg-orange-100 text-orange-700" },
  LOW_RELIABILITY:   { label: "Niska pouzdanost", cls: "bg-red-100 text-red-700" },
  SANITARY_EXPIRING: { label: "Sanitarna",        cls: "bg-amber-100 text-amber-700" },
  SANITARY_INVALID:  { label: "Sanitarna",        cls: "bg-red-100 text-red-700" },
};
