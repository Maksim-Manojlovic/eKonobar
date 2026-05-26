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
  applications:  "Prijave",
  waiters:       "Konobari",
  discover:      "Pronađi konobara",
  reviews:       "Recenzije",
  "qr-review":   "QR Recenzije",
  profile:       "Profil lokala",
  notifications: "Obaveštenja",
};
