import { useQuery } from "@tanstack/react-query";
import type { WaiterSearchResponse } from "@ekonobar/shared/api/venue";
import { apiGet } from "./client";

/**
 * GET /api/waiters — the owner/headhunter talent search.
 *
 * Ranking is by passport score at the DB; there is no purchasable priority and
 * none should be added here. The query builder omits empty values rather than
 * sending `?search=`, which the route would treat as a filter matching nothing.
 */

export type WaiterFilters = {
  search?:           string;
  available?:        boolean;
  minScore?:         number;
  sanitaryBook?:     boolean;
  verificationTier?: string;
  municipality?:     string;
  skills?:           string[];
  minExperience?:    number;
};

export function buildWaiterQuery(f: WaiterFilters): string {
  const q = new URLSearchParams();
  if (f.search?.trim())      q.set("search", f.search.trim());
  if (f.available)           q.set("available", "true");
  if (f.sanitaryBook)        q.set("sanitaryBook", "true");
  if (f.minScore)            q.set("minScore", String(f.minScore));
  if (f.minExperience)       q.set("minExperience", String(f.minExperience));
  if (f.verificationTier)    q.set("verificationTier", f.verificationTier);
  if (f.municipality)        q.set("municipality", f.municipality);
  if (f.skills?.length)      q.set("skills", f.skills.join(","));
  return q.toString();
}

export function useWaiterSearch(filters: WaiterFilters, enabled = true) {
  const qs = buildWaiterQuery(filters);
  return useQuery({
    queryKey: ["waiters", qs],
    queryFn:  () => apiGet<WaiterSearchResponse>(`/api/waiters${qs ? `?${qs}` : ""}`),
    enabled,
  });
}
