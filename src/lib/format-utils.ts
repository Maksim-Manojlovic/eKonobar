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
