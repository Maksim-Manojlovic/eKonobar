import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeaveBalanceResponse, WaiterLeaveRequest } from "@ekonobar/shared/api/waiter";
import type { LeaveRequestsResponse } from "@ekonobar/shared/api/venue";
import { api, apiGet } from "./client";

/**
 * Odmori.
 *
 * Balances are per-venue, not one number: leave taken at one venue says nothing
 * about availability at another, so a worker on two rosters sees two entries
 * rather than a misleading total.
 *
 * GET /api/leave/requests branches on venueId — without it the caller is asking
 * for their own history across venues (`scope: "own"`), with it a manager gets
 * their departments' queue (`scope: "manage"`) and everyone else still gets only
 * their own rows. One endpoint serves both screens, so both use this module.
 */

export const useLeaveBalance = () =>
  useQuery({
    queryKey: ["leave", "balance"],
    queryFn:  () => apiGet<LeaveBalanceResponse>("/api/leave/balance"),
  });

export const useMyLeaveRequests = () =>
  useQuery({
    queryKey: ["leave", "requests", "own"],
    queryFn:  () => apiGet<{ requests: WaiterLeaveRequest[] }>("/api/leave/requests"),
  });

export const useVenueLeaveRequests = (venueId: string | undefined) =>
  useQuery({
    queryKey: ["leave", "requests", "venue", venueId],
    queryFn:  () => apiGet<LeaveRequestsResponse>(`/api/leave/requests?venueId=${venueId}`),
    enabled:  !!venueId,
  });

export type NewLeaveRequest = {
  venueId:   string;
  type:      string;
  startDate: string;
  endDate:   string;
  reason?:   string | null;
};

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewLeaveRequest) =>
      api("/api/leave/requests", { method: "POST", body }),
    // A request reserves pending days immediately, so the balance is stale the
    // moment one is filed — even when it lands PENDING rather than APPROVED.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });
}

export function useResolveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, rejectReason }: {
      id: string;
      action: "approve" | "reject" | "cancel";
      rejectReason?: string | null;
    }) => api(`/api/leave/requests/${id}`, { method: "PATCH", body: { action, rejectReason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });
}
