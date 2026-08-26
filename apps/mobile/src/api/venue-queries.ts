/**
 * Venue-owner queries and mutations.
 *
 * Response types come from @ekonobar/shared/api/venue — the same declarations the
 * web venue dashboard uses.
 *
 * Owner surfaces are venue-scoped, so most reads need a venueId. `useMyVenues`
 * resolves it once and everything else takes it as an argument, disabled until
 * it exists, rather than each screen re-fetching the venue list.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  IncomingApp,
  OwnPost,
  Venue,
  VenueReview,
  VenueShift,
} from "@ekonobar/shared/api/venue";
import { api, apiGet } from "./client";

// GET /api/venues and GET /api/jobs both branch on the session role: a
// VENUE_OWNER gets their own venues / their own posts, everyone else gets the
// public browse set. So there is no "mine" parameter to pass — asking for one
// would have been silently ignored and returned the wrong list.
export const useMyVenues = () =>
  useQuery({ queryKey: ["venues", "mine"], queryFn: () => apiGet<Venue[]>("/api/venues") });

/** The owner's first venue. v1 assumes one venue per owner, which is the common case. */
export function usePrimaryVenue() {
  const q = useMyVenues();
  return { ...q, venue: q.data?.[0] ?? null };
}

export const useOwnPosts = () =>
  useQuery({ queryKey: ["posts", "mine"], queryFn: () => apiGet<OwnPost[]>("/api/jobs") });

export const useIncomingApps = () =>
  useQuery({ queryKey: ["applications", "incoming"], queryFn: () => apiGet<IncomingApp[]>("/api/jobs/applications") });

export const useManagedShifts = () =>
  useQuery({
    queryKey: ["shifts", "manage"],
    // Returns 200 { venue: null, shifts: [] } for someone who manages nothing —
    // managing nothing is not "forbidden", so this is never a 403 to handle.
    queryFn:  () => apiGet<{ venue: { id: string } | null; shifts: VenueShift[] }>("/api/shifts?view=manage"),
  });

export const useVenueReviews = (venueId: string | undefined) =>
  useQuery({
    queryKey: ["reviews", "venue", venueId],
    queryFn:  () => apiGet<VenueReview[]>(`/api/venues/${venueId}/reviews`),
    enabled:  Boolean(venueId),
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export type AppStatus = "SHORTLISTED" | "ACCEPTED" | "REJECTED" | "COMPLETED";

export function useSetApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppStatus }) =>
      api(`/api/jobs/applications/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      // ACCEPTED can fill a post, and COMPLETED writes an engagement record —
      // both change what the posts list shows.
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

/**
 * Approve or reject a clock-in that arrived outside the geofence.
 *
 * Load-bearing in v1: with no device location in the app, EVERY mobile clock-in
 * lands here awaiting a decision (mobile-app-plan §2). If this screen is slow or
 * hidden, waiters do not get clocked in.
 */
export function useResolveClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, action }: { assignmentId: string; action: "approve" | "reject" }) =>
      api(`/api/shifts/assignments/${assignmentId}/approve-clockin`, { method: "PATCH", body: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useResolveSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, action }: { swapId: string; action: "ACCEPTED" | "REJECTED" }) =>
      api(`/api/shifts/swaps/${swapId}`, { method: "PATCH", body: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api(`/api/reviews/${id}`, { method: "PATCH", body: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useSetPostStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      api(`/api/jobs/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}
