// Runtime display constants for the Venue dashboard.
// Import types from ./venue-types — never the reverse.
// No JSX — safe to import in both client and server contexts.

import type { Section } from "./venue-types";

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
