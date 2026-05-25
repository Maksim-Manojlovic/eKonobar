"use client";

import { getInitials } from "@/lib/formatting/utils";

// ── Initials avatar ───────────────────────────────────────────────────────────

/**
 * Circular initials avatar — shared across headhunter, venue, and passport views.
 *
 * @param className - size + text-size overrides (default: "w-12 h-12 text-base")
 *   Common values:
 *     "w-9  h-9  text-sm"  — compact list rows
 *     "w-12 h-12 text-base" — standard card (default)
 *     "w-16 h-16 text-xl"  — passport hero card
 */
export function Initials({
  name,
  className = "w-12 h-12 text-base",
}: {
  name?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center border-2 border-orange-200 flex-shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Passport tier badge ───────────────────────────────────────────────────────

/**
 * Shows "PRO" or "PRO+" badge. Returns null for FREE tier or expired subscriptions.
 */
export function PassportTierBadge({
  tier,
  expiresAt,
}: {
  tier?: string;
  expiresAt?: string | null;
}) {
  if (!tier || tier === "FREE") return null;
  if (expiresAt && new Date(expiresAt) <= new Date()) return null;
  if (tier === "PRO_PLUS")
    return (
      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white tracking-wide">
        PRO+
      </span>
    );
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300">
      PRO
    </span>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

/**
 * Colour-coded passport score pill (0–100).
 * Orange ≥85 · Amber ≥70 · Neutral otherwise.
 */
export function ScorePill({ score }: { score: number }) {
  const color =
    score >= 85 ? "#f97316" : score >= 70 ? "#eab308" : "#6b7280";
  return (
    <span
      className="text-xs font-black px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {Math.round(score)}
    </span>
  );
}
