"use client";

import { getInitials } from "@/lib/formatting/utils";
import { isVerified, VERIFICATION_LABELS } from "@/lib/formatting/display-maps";

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

// ── Verification badge ────────────────────────────────────────────────────────

/**
 * Binary "is this a proven person?" badge, with the evidence source named.
 *
 * Replaces the old Bronze→Platinum ladder. Verification is not a rank — see the
 * note above VERIFICATION_LABELS in lib/formatting/display-maps.ts. Waiter
 * *performance* is the separate 0–100 score rendered by <ScorePill />.
 */
export function VerifiedBadge({ tier }: { tier?: string | null }) {
  const label = VERIFICATION_LABELS[tier ?? "UNVERIFIED"] ?? VERIFICATION_LABELS.UNVERIFIED;

  if (!isVerified(tier)) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">
        {label}
      </span>
    );
  }

  return (
    <span
      title={`Verifikovano: ${label}`}
      className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-300 inline-flex items-center gap-1"
    >
      <span aria-hidden>✓</span> Verifikovan
    </span>
  );
}

/**
 * The evidence chip that pairs with <VerifiedBadge />: names *what* was proven.
 * Renders nothing for UNVERIFIED (the badge already says so).
 */
export function VerificationProofChip({ tier }: { tier?: string | null }) {
  if (!isVerified(tier)) return null;
  return (
    <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
      {VERIFICATION_LABELS[tier!] ?? tier}
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
