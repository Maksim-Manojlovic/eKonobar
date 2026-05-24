/**
 * Shared pure formatting utilities.
 *
 * No domain logic, no imports from other project modules.
 * Safe to import from any layer (components, pages, lib).
 */

/* ── String helpers ──────────────────────────────────────────────────────── */

/** Returns up to 2 uppercase initials from a display name, or "?" when blank. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ── Relative time ───────────────────────────────────────────────────────── */

/**
 * Returns a short Serbian relative-time string for a past ISO date or date string.
 * Granularity: minutes → hours → days → months.
 *
 * Examples: "upravo", "pre 5min", "pre 2h", "pre 3d", "pre 1m"
 */
export function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2)   return "upravo";
  if (mins < 60)  return `pre ${mins}min`;
  if (hours < 24) return `pre ${hours}h`;
  if (days < 30)  return `pre ${days}d`;
  return `pre ${Math.floor(days / 30)}m`;
}

/* ── Salary formatting ───────────────────────────────────────────────────── */

type SalaryFields = {
  salaryMin:      number | null;
  salaryMax:      number | null;
  engagementType: string;
};

/**
 * Formats a salary range as a Serbian locale string.
 * Falls back to "Po dogovoru" when both values are absent.
 * Suffix: "/mes" for FULL_TIME, "/sm" for all other engagement types.
 */
export function formatSalary({ salaryMin, salaryMax, engagementType }: SalaryFields): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax)
    return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}
