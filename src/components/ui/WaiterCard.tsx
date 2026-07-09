"use client";

import type { ReactNode } from "react";
import { VERIFICATION_TIER_COLORS } from "@/lib/formatting/display-maps";
import { Initials, PassportTierBadge, ScorePill } from "@/components/ui/PassportWidgets";

/**
 * Common subset of the `GET /api/waiters` row that the shared card renders. Fields that
 * only some callers provide (`reviewCount`, `totalEngagements`) are optional and gated by
 * `showStats`. Both headhunter's `Waiter` and venue's `WaiterEntry` are structurally
 * assignable to this.
 */
export interface WaiterCardData {
  id: string;
  name?: string | null;
  image?: string | null;
  verificationTier: string;
  waiterPassport?: {
    score: number;
    skills: string[];
    yearsExperience: number;
    sanitaryBookValid: boolean;
    currentlyAvailable: boolean;
    reviewCount?: number;
    totalEngagements?: number;
    passportTier?: string;
    subscriptionExpiresAt?: string | null;
  } | null;
}

/**
 * Shared waiter result card (CQ-P). Renders the avatar + name + verification/passport
 * badges + score + skills + availability the headhunter search and venue discover views
 * both duplicated. Action buttons differ per surface, so they are injected via `actions`.
 *
 * @param showStats  render the engagements / reviews / years-experience grid (headhunter).
 * @param maxSkills  how many skill chips before the "+N" overflow (default 4).
 * @param actions    surface-specific buttons rendered in the card footer.
 */
export function WaiterCard({
  waiter,
  actions,
  showStats = false,
  maxSkills = 4,
}: {
  waiter: WaiterCardData;
  actions?: ReactNode;
  showStats?: boolean;
  maxSkills?: number;
}) {
  const p = waiter.waiterPassport;

  return (
    <div className="dash-card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {waiter.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={waiter.image} alt={waiter.name ?? ""} className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 flex-shrink-0" />
          : <Initials name={waiter.name} />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-black text-neutral-900 text-sm truncate">{waiter.name ?? "Konobar"}</p>
            <PassportTierBadge tier={p?.passportTier} expiresAt={p?.subscriptionExpiresAt} />
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_TIER_COLORS[waiter.verificationTier] ?? VERIFICATION_TIER_COLORS.UNVERIFIED}`}>
            {waiter.verificationTier.replace("_", " ")}
          </span>
        </div>
        {p && <ScorePill score={p.score} />}
      </div>

      {p && (
        <>
          {showStats && (
            <div className="flex gap-3 text-center">
              {[
                { label: "Angažmana", v: p.totalEngagements ?? 0 },
                { label: "Recenzija",  v: p.reviewCount ?? 0 },
                { label: "God. isku.", v: p.yearsExperience },
              ].map(({ label, v }) => (
                <div key={label} className="flex-1">
                  <p className="text-sm font-black text-neutral-900">{v}</p>
                  <p className="text-[10px] text-neutral-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          {p.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.skills.slice(0, maxSkills).map((s) => (
                <span key={s} className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  {s}
                </span>
              ))}
              {p.skills.length > maxSkills && (
                <span className="text-xs text-neutral-400">+{p.skills.length - maxSkills}</span>
              )}
            </div>
          )}

          <div className="flex gap-1.5 flex-wrap">
            {p.currentlyAvailable && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Dostupan
              </span>
            )}
            {p.sanitaryBookValid && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                📋 Sanitarna
              </span>
            )}
            {!showStats && p.yearsExperience > 0 && (
              <span className="text-xs text-neutral-400 px-1 py-0.5">{p.yearsExperience}g iskustva</span>
            )}
          </div>
        </>
      )}

      {actions && <div className="flex gap-2 mt-auto pt-1">{actions}</div>}
    </div>
  );
}
