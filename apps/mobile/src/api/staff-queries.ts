import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffResponse } from "@ekonobar/shared/api/venue";
import { api, apiGet } from "./client";

/**
 * Ekipa — the venue roster.
 *
 * A VenueStaff row is what makes someone *employed here*, as distinct from
 * having picked up an open shift. Leave balances, department scoping and the
 * head-of-department permissions all key off it, so this is the screen that
 * unblocks Odmori.
 *
 * `canManage` comes back on the response rather than being inferred from the
 * role: a head waiter may view their own department but not edit it, and only
 * the server knows which venue they head.
 */

export const useStaff = (venueId: string | undefined, includeEnded = false) =>
  useQuery({
    queryKey: ["staff", venueId, includeEnded],
    queryFn:  () => apiGet<StaffResponse>(
      `/api/venues/${venueId}/staff${includeEnded ? "?includeEnded=true" : ""}`,
    ),
    enabled: !!venueId,
  });

export type NewStaff = {
  waiterId:       string;
  position:       string;
  employmentType: string;
  startedAt:      string;
  notes?:         string | null;
};

export function useAddStaff(venueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewStaff) =>
      api(`/api/venues/${venueId}/staff`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export type StaffPatch = {
  position?:       string;
  employmentType?: string;
  status?:         "ACTIVE" | "SUSPENDED" | "ENDED";
  endedAt?:        string | null;
  notes?:          string | null;
};

export function useUpdateStaff(venueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, patch }: { staffId: string; patch: StaffPatch }) =>
      api(`/api/venues/${venueId}/staff/${staffId}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      // Ending someone's employment removes their leave balance at this venue,
      // and promoting to a head position changes who may decide on requests.
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
  });
}
