import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShiftTemplate } from "@ekonobar/shared/api/venue";
import { api, apiGet } from "./client";

/**
 * Šabloni — recurring shift patterns.
 *
 * A template is not a shift. It describes one repeating slot ("Friday evening,
 * three people, 18:00–02:00") and generation turns a date range into real Shift
 * rows from it. Generation is idempotent on `templateId + date`, so running it
 * twice over an overlapping range creates nothing the second time — which is
 * what makes "generate the next month" a safe button to press repeatedly.
 */

export const useTemplates = () =>
  useQuery({
    queryKey: ["templates"],
    queryFn:  () => apiGet<ShiftTemplate[]>("/api/shifts/templates"),
  });

export type NewTemplate = {
  venueId:       string;
  name:          string;
  dayOfWeek:     number | null;
  weekdaysOnly:  boolean;
  startTime:     string;
  endTime:       string;
  requiredCount: number;
  role:          string | null;
  pay:           number | null;
};

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewTemplate) =>
      api("/api/shifts/templates", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    // Shift.templateId is onDelete: SetNull, so shifts already generated survive
    // with their link cleared — they are real rows people may be assigned to.
    // The consequence worth knowing: generation is idempotent on templateId +
    // date, so a re-created template will happily regenerate those same dates.
    mutationFn: (id: string) => api(`/api/shifts/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export type GenerateResult = {
  created: number;
  skipped: number;
  /** Dates where roster members are already on approved leave. */
  leaveNotices?: { date: string; onLeave: number }[];
};

export function useGenerateShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fromDate, toDate }: { id: string; fromDate: string; toDate: string }) =>
      api<GenerateResult>(`/api/shifts/templates/${id}/generate`, {
        method: "POST",
        body: { fromDate, toDate },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}
