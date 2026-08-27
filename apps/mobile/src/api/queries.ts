/**
 * Typed query and mutation hooks over the existing API.
 *
 * Every response type is imported from @ekonobar/shared/api/waiter — the same
 * declarations the web dashboard uses — so a route that changes shape breaks both
 * clients at compile time instead of one of them at runtime.
 *
 * Query keys are arrays with a stable prefix so a mutation can invalidate a whole
 * family (`["shifts"]`) without knowing every variant beneath it.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InviteItem,
  JobPost,
  MarketData,
  MyApplication,
  OpenShift,
  PassportData,
  SwapRequest,
  WaiterReview,
  WaiterShift,
} from "@ekonobar/shared/api/waiter";
import { api, apiGet } from "./client";

// ── Reads ─────────────────────────────────────────────────────────────────────

export const useMarket = () =>
  useQuery({ queryKey: ["insights", "market"], queryFn: () => apiGet<MarketData>("/api/insights/market") });

const JOBS_PAGE = 20;

/**
 * Paged job feed.
 *
 * The route returns a bare array and takes `?cursor=&limit=`, so "there is more"
 * is inferred from getting back a full page. That costs one extra empty request
 * when the total is an exact multiple of the page size — cheaper than a payload
 * shape that differs between web and mobile.
 *
 * The Red Alert filter is a query param, never a .filter() on the response: the
 * route caps its result set, so filtering client-side would filter an already
 * truncated page and quietly under-report.
 */
export const useJobs = (opts: { redAlertOnly?: boolean } = {}) =>
  useInfiniteQuery({
    queryKey: ["jobs", opts],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: String(JOBS_PAGE) });
      if (opts.redAlertOnly) q.set("redAlert", "true");
      if (pageParam)         q.set("cursor", pageParam);
      return apiGet<JobPost[]>(`/api/jobs?${q}`);
    },
    getNextPageParam: (last: JobPost[]) =>
      last.length === JOBS_PAGE ? last[last.length - 1]?.id : undefined,
  });

export const useMyApplications = () =>
  useQuery({ queryKey: ["applications"], queryFn: () => apiGet<MyApplication[]>("/api/jobs/applications") });

export const useInvites = () =>
  useQuery({ queryKey: ["invites"], queryFn: () => apiGet<InviteItem[]>("/api/invites") });

export const useMyShifts = () =>
  useQuery({ queryKey: ["shifts", "mine"], queryFn: () => apiGet<WaiterShift[]>("/api/shifts") });

export const useOpenShifts = () =>
  useQuery({ queryKey: ["shifts", "open"], queryFn: () => apiGet<OpenShift[]>("/api/shifts?view=open") });

export const useSwapRequests = () =>
  useQuery({ queryKey: ["shifts", "swaps"], queryFn: () => apiGet<SwapRequest[]>("/api/shifts?view=swaps") });

export const usePassport = () =>
  useQuery({ queryKey: ["passport"], queryFn: () => apiGet<PassportData>("/api/passport") });

/**
 * Reviews received by one waiter.
 *
 * `subjectId` is mandatory: GET /api/reviews answers 400 with
 * "venueId or subjectId required" rather than defaulting to the caller, because
 * the same route serves the public published-review feed.
 */
export const useReviews = (subjectId: string | undefined) =>
  useQuery({
    queryKey: ["reviews", "subject", subjectId],
    queryFn:  () => apiGet<WaiterReview[]>(`/api/reviews?subjectId=${subjectId}`),
    enabled:  Boolean(subjectId),
  });

// ── Writes ────────────────────────────────────────────────────────────────────

export function useApplyToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobPostId: string) =>
      api("/api/jobs/applications", { method: "POST", body: { jobPostId } }),
    onSuccess: () => {
      // The job list carries an "already applied" flag for signed-in waiters, so
      // it is stale too — not just the applications list.
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useClaimShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) => api(`/api/shifts/${shiftId}/claim`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export type ClockInResult = { pending?: boolean };

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    // No coordinates: device location is out of scope for v1 (mobile-app-plan §2),
    // so the route takes its manager-approval path and answers 202 { pending: true }.
    // That is expected here, not an error — the UI shows "Čekamo odobrenje…".
    mutationFn: (shiftId: string) =>
      api<ClockInResult>(`/api/shifts/${shiftId}/clockin`, { method: "POST", body: { method: "QR" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) => api(`/api/shifts/${shiftId}/clockout`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

export function useRespondToInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACCEPTED" | "DECLINED" }) =>
      api(`/api/invites/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationRow = {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  link:      string | null;
  read:      boolean;
  createdAt: string;
};

/** GET /api/notifications answers { notifications, unreadCount } — not a bare array. */
export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn:  () => apiGet<{ notifications: NotificationRow[]; unreadCount: number }>("/api/notifications"),
    // The bell shows a count, so it needs to move without a manual refresh.
    refetchInterval: 60_000,
  });

const NOTIF_PAGE = 25;

/**
 * The full notification history, for the notifications screen.
 *
 * Separate from useNotifications, which the bell owns: the bell wants one small
 * polled page and a count, this wants to keep walking backwards. They share the
 * route — the first page is the Redis-cached one either way — but not a query
 * key, so paging here never disturbs the bell's poll.
 */
export const useNotificationHistory = () =>
  useInfiniteQuery({
    queryKey: ["notifications", "history"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: String(NOTIF_PAGE) });
      if (pageParam) q.set("cursor", pageParam);
      return apiGet<{ notifications: NotificationRow[]; unreadCount: number }>(
        `/api/notifications?${q}`,
      );
    },
    getNextPageParam: (last) =>
      last.notifications.length === NOTIF_PAGE
        ? last.notifications[last.notifications.length - 1]?.id
        : undefined,
  });

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api("/api/notifications", { method: "PATCH", body: ids ? { ids } : {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ── Notification preferences ──────────────────────────────────────────────────

export type NotificationPrefs = {
  phone:    string | null;
  smsOptIn: boolean;
  waOptIn:  boolean;
};

export const useNotificationPrefs = () =>
  useQuery({
    queryKey: ["prefs", "notifications"],
    queryFn:  () => apiGet<NotificationPrefs>("/api/user/notification-prefs"),
  });

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    // Partial update — only the keys present are applied, so a toggle does not
    // have to send the phone number along with it.
    mutationFn: (patch: Partial<NotificationPrefs>) =>
      api<NotificationPrefs>("/api/user/notification-prefs", { method: "PATCH", body: patch }),
    onSuccess: fresh => qc.setQueryData(["prefs", "notifications"], fresh),
  });
}

/** Availability drives whether the waiter appears in owner search at all. */
export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currentlyAvailable: boolean) =>
      api("/api/passport", { method: "PUT", body: { currentlyAvailable } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["passport"] }),
  });
}
