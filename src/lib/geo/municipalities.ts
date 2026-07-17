/**
 * Canonical Belgrade city municipalities (gradske opštine).
 *
 * Single source of truth for where a waiter declares they will work
 * (`WaiterPassport.workMunicipalities`) and where a venue owner filters the
 * waiter search. Both sides pick from this list, so the match is an exact
 * string `has` — never a fuzzy join on the free-text `Venue.municipality`.
 *
 * Ordered urban-core first (highest hospitality density) so the picker surfaces
 * the municipalities most waiters actually work in before the outer ones.
 *
 * Beograd-only today. Serbia-wide later means adding a city → municipalities map
 * keyed off `lib/geo/cities.ts`; nothing that consumes this constant needs to
 * change its shape (still a `string[]` of names).
 */
export const BELGRADE_MUNICIPALITIES = [
  // Urban core
  "Stari grad",
  "Vračar",
  "Savski venac",
  "Novi Beograd",
  "Zvezdara",
  "Palilula",
  "Voždovac",
  "Rakovica",
  "Čukarica",
  "Zemun",
  "Surčin",
  // Suburban
  "Barajevo",
  "Grocka",
  "Lazarevac",
  "Mladenovac",
  "Obrenovac",
  "Sopot",
] as const;

export type BelgradeMunicipality = (typeof BELGRADE_MUNICIPALITIES)[number];

const MUNICIPALITY_SET: ReadonlySet<string> = new Set(BELGRADE_MUNICIPALITIES);

/** True when `value` is a recognised municipality name. */
export function isKnownMunicipality(value: string): value is BelgradeMunicipality {
  return MUNICIPALITY_SET.has(value);
}

/**
 * Legacy / colloquial names mapped to their canonical opština.
 *
 * Covers the casing drift and neighborhood names that were enterable while the
 * venue municipality was a free-text field (e.g. the old register `CITIES` list),
 * so the backfill and any lenient write path can recover them. Keys are matched
 * case-insensitively — see `normalizeMunicipality`.
 */
const MUNICIPALITY_ALIASES: Readonly<Record<string, BelgradeMunicipality>> = {
  "dorćol": "Stari grad",
  "dorcol": "Stari grad",
  "savamala": "Savski venac",
  "savski venac": "Savski venac",
  "stari grad": "Stari grad",
  "novi beograd": "Novi Beograd",
  "vozdovac": "Voždovac",
  "vracar": "Vračar",
  "cukarica": "Čukarica",
};

/**
 * Best-effort mapping of arbitrary input to a canonical municipality, or `null`
 * when unrecognised.
 *
 * Order: exact canonical → case-insensitive canonical → alias table. Lets a
 * write path accept "stari grad" / "Dorćol" and store the canonical form, and
 * lets the backfill recover legacy free-text values without a hand audit.
 */
export function normalizeMunicipality(input: string): BelgradeMunicipality | null {
  const v = input.trim();
  if (isKnownMunicipality(v)) return v;

  const lower = v.toLowerCase();
  const canonical = BELGRADE_MUNICIPALITIES.find((m) => m.toLowerCase() === lower);
  if (canonical) return canonical;

  return MUNICIPALITY_ALIASES[lower] ?? null;
}

/**
 * Filters arbitrary input down to recognised municipalities, de-duplicated and
 * in canonical order.
 *
 * Applied server-side before persisting `workMunicipalities` so junk, dupes and
 * casing drift never reach the DB — the later coverage choropleth aggregates on
 * these values and can't afford "Vračar" and "vracar" as two cells.
 */
export function sanitizeMunicipalities(input: readonly string[]): BelgradeMunicipality[] {
  const seen = new Set<string>();
  for (const raw of input) {
    const v = raw.trim();
    if (isKnownMunicipality(v)) seen.add(v);
  }
  return BELGRADE_MUNICIPALITIES.filter((m) => seen.has(m));
}
