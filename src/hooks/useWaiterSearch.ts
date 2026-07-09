"use client";

import { useApi } from "@/hooks/useApi";

/**
 * Canonical filter set for `GET /api/waiters`.
 *
 * Single source of truth for the query the waiter-search feature builds. Before CQ-P
 * (tech_debt_audit.md) three clients — `headhunter/search`, venue `DiscoverSection`, and
 * `venue/invites` — each hand-rolled this `URLSearchParams` assembly + fetch. Empty /
 * falsy values are omitted from the query.
 */
export interface WaiterFilters {
  search?: string;
  minScore?: string | number;
  verificationTier?: string;
  available?: boolean;
  sanitaryBook?: boolean;
  minExperience?: string | number;
  skills?: string;
  languages?: string;
}

/** Pure builder — exported for unit testing. Omits empty/falsy params. */
export function buildWaiterQuery(f: WaiterFilters): string {
  const params = new URLSearchParams();
  if (f.search)                     params.set("search", String(f.search));
  if (f.minScore)                   params.set("minScore", String(f.minScore));
  if (f.verificationTier)           params.set("verificationTier", f.verificationTier);
  if (f.available)                  params.set("available", "true");
  if (f.sanitaryBook)               params.set("sanitaryBook", "true");
  if (f.minExperience)              params.set("minExperience", String(f.minExperience));
  if (f.skills)                     params.set("skills", f.skills);
  if (f.languages)                  params.set("languages", f.languages);
  return params.toString();
}

/**
 * Shared waiter-search hook. Builds the `/api/waiters` query from `filters` and fetches
 * via `useApi` (CQ-H) — so callers get loading/error/unmount-safety for free and no longer
 * reimplement the query+fetch triplet.
 *
 * Reactive: refetches whenever `filters` change the resulting query string. For a
 * button-triggered UX (e.g. headhunter), hold a separate "applied" filters object in the
 * caller and only update it on submit — the query string (and thus the fetch) then only
 * changes on submit. `enabled: false` skips the fetch entirely (e.g. a collapsed panel).
 *
 * Generic over the waiter row shape `<T>` so each caller keeps its own typed response
 * without a cross-file type merge.
 *
 * ```ts
 * const { waiters, isLoading } = useWaiterSearch<Waiter>(applied);
 * ```
 */
export function useWaiterSearch<T>(
  filters: WaiterFilters,
  options: { enabled?: boolean } = {},
) {
  const qs = buildWaiterQuery(filters);
  const { data, error, isLoading, mutate } = useApi<{ waiters: T[] }>(
    `/api/waiters?${qs}`,
    { enabled: options.enabled },
  );
  return { waiters: data?.waiters ?? [], error, isLoading, mutate };
}
