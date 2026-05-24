"use client";

import type { Section, Venue } from "./venue-types";
export { PassportTierBadge, ScorePill } from "@/components/ui/PassportWidgets";

export function PostStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE")  return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Aktivan</span>;
  if (status === "PAUSED")  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Pauziran</span>;
  if (status === "FILLED")  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Popunjen</span>;
  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
}

export function AppStatusBadge({ status }: { status: string }) {
  if (status === "ACCEPTED")    return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Prihvaćen</span>;
  if (status === "REJECTED")    return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Odbijen</span>;
  if (status === "SHORTLISTED") return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>Shortlist</span>;
  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Na čekanju</span>;
}

export function TierBadge({ tier }: { tier: string }) {
  if (tier === "GOLD")   return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🥇 GOLD</span>;
  if (tier === "SILVER") return <span className="bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">🥈 SILVER</span>;
  return null;
}


export function Sk({ className = "" }: { className?: string }) {
  return <div className={`bg-neutral-200 rounded-lg animate-pulse ${className}`} />;
}

export function OverviewSkeleton() {
  return (
    <>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <Sk className="w-24 h-24 rounded-full flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex gap-2">
            <Sk className="h-5 w-16 rounded-full" />
            <Sk className="h-5 w-20 rounded-full" />
          </div>
          <Sk className="h-7 w-48" />
          <Sk className="h-4 w-64" />
          <div className="flex gap-6 mt-1">
            {[1,2,3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Sk className="h-6 w-8" />
                <Sk className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <Sk className="h-9 w-28 rounded-xl flex-shrink-0" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1,2].map(i => (
          <div key={i} className="dash-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Sk className="h-4 w-28" />
              <Sk className="h-4 w-8" />
            </div>
            {[1,2,3].map(j => (
              <div key={j} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div className="flex flex-col gap-1.5">
                  <Sk className="h-4 w-36" />
                  <Sk className="h-3 w-24" />
                </div>
                <Sk className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="dash-card p-5 flex flex-col gap-3">
        <Sk className="h-4 w-40 mb-1" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <Sk className="h-3 w-24" />
                <Sk className="h-3 w-8" />
              </div>
              <Sk className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function PostsSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Sk className="h-7 w-32" />
        <Sk className="h-9 w-28 rounded-xl" />
      </div>
      <div className="flex flex-col gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="dash-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sk className="h-5 w-48" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
                <Sk className="h-4 w-36" />
                <Sk className="h-3 w-52" />
              </div>
              <Sk className="h-8 w-20 rounded-xl flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ApplicationsSkeleton() {
  return (
    <>
      <Sk className="h-7 w-48" />
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1">
        {[1,2,3,4,5].map(i => <Sk key={i} className="h-7 flex-1 rounded-lg" />)}
      </div>
      <div className="flex flex-col gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="dash-card p-5">
            <div className="flex items-start gap-4">
              <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sk className="h-5 w-32" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
                <Sk className="h-3 w-48" />
                <div className="flex gap-1 mt-1">
                  <Sk className="h-4 w-14 rounded-full" />
                  <Sk className="h-4 w-14 rounded-full" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Sk className="h-5 w-20 rounded-full" />
                <div className="flex gap-1.5">
                  <Sk className="h-7 w-16 rounded-lg" />
                  <Sk className="h-7 w-12 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function WaitersSkeleton() {
  return (
    <>
      <Sk className="h-7 w-64" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="dash-card p-5">
            <div className="flex items-start gap-3">
              <Sk className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sk className="h-5 w-28" />
                  <Sk className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex gap-1">
                  <Sk className="h-4 w-12 rounded-full" />
                  <Sk className="h-4 w-14 rounded-full" />
                  <Sk className="h-4 w-10 rounded-full" />
                </div>
                <Sk className="h-3 w-24" />
              </div>
              <Sk className="h-7 w-14 rounded-xl flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DiscoverSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="dash-card p-5">
          <div className="flex items-start gap-3">
            <Sk className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sk className="h-5 w-28" />
                <Sk className="h-4 w-16 rounded-full" />
              </div>
              <div className="flex gap-1">
                <Sk className="h-4 w-12 rounded-full" />
                <Sk className="h-4 w-14 rounded-full" />
              </div>
              <Sk className="h-3 w-20" />
            </div>
            <Sk className="h-7 w-14 rounded-xl flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1,2,3].map(i => (
        <div key={i} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sk className="w-7 h-7 rounded-full" />
              <Sk className="h-4 w-28" />
            </div>
            <Sk className="h-4 w-16 rounded-full" />
          </div>
          <Sk className="h-3 w-full mb-1.5" />
          <Sk className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ShiftsSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Sk className="h-7 w-32" />
        <div className="flex gap-2">
          <Sk className="h-8 w-20 rounded-xl" />
          <Sk className="h-8 w-20 rounded-xl" />
        </div>
      </div>
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <Sk className="h-5 w-32" />
          <div className="flex gap-2">
            <Sk className="h-7 w-7 rounded-lg" />
            <Sk className="h-7 w-7 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Sk key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="dash-card p-4">
            <div className="flex items-center justify-between mb-2">
              <Sk className="h-4 w-24" />
              <Sk className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-2">
              {[1,2].map(j => <Sk key={j} className="h-6 w-20 rounded-full" />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function EmptyVenue({ onNavigate }: { onNavigate: (s: Section) => void }) {
  return (
    <div className="dash-card p-10 flex flex-col items-center gap-4 text-center">
      <div className="text-4xl">🏠</div>
      <div>
        <h3 className="font-bold text-neutral-900">Nemaš registrovan lokal</h3>
        <p className="text-sm text-neutral-400 mt-1">Dodaj lokal kako bi mogao da objaviš oglas.</p>
      </div>
      <button onClick={() => onNavigate("profile")} className="btn-dash-orange px-5 py-2">Dodaj lokal</button>
    </div>
  );
}

/* ── Trust score display ─────────────────────────────────────────────────── */

/** Maps a venueTrustScore DB object to a label+value array for chart rendering. */
export function trustDimensions(ts: Venue["venueTrustScore"]): { label: string; value: number }[] {
  if (!ts) return [
    { label: "Atmosfera", value: 0 }, { label: "Organizacija", value: 0 },
    { label: "Isplata", value: 0 },   { label: "Bakšiš sistem", value: 0 },
    { label: "Higijena", value: 0 },  { label: "Menadžment", value: 0 },
  ];
  return [
    { label: "Atmosfera",     value: Math.round(ts.atmosphere)      },
    { label: "Organizacija",  value: Math.round(ts.organization)    },
    { label: "Isplata",       value: Math.round(ts.pay)             },
    { label: "Bakšiš sistem", value: Math.round(ts.tips)            },
    { label: "Higijena",      value: Math.round(ts.hygieneStandards)},
    { label: "Menadžment",    value: Math.round(ts.management)      },
  ];
}
