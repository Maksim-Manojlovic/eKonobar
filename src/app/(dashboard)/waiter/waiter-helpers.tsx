"use client";

import { useState, useEffect } from "react";
import type { Section, MarketData } from "./waiter-types";
export { Stars } from "@/components/ui/Stars";

/* ── Application status helper ───────────────────────────────────────────── */

export function appStatusKey(status: string): "accepted" | "pending" | "rejected" {
  if (status === "ACCEPTED" || status === "COMPLETED") return "accepted";
  if (status === "REJECTED" || status === "WITHDRAWN") return "rejected";
  return "pending";
}

/* ── Base helpers ─────────────────────────────────────────────────────────── */

export function StatusBadge({ status }: { status: string }) {
  const key = appStatusKey(status);
  const cls = key === "accepted" ? "badge-accepted" : key === "pending" ? "badge-pending" : "badge-rejected";
  const labels: Record<string, string> = {
    ACCEPTED: "Prihvaćeno", COMPLETED: "Završeno", SHORTLISTED: "Shortlist",
    PENDING: "Na čekanju", REJECTED: "Odbijeno", WITHDRAWN: "Povučena",
  };
  return <span className={`${cls} text-xs font-semibold px-2.5 py-0.5 rounded-full`}>{labels[status] ?? status}</span>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

import { Sk } from "@/components/ui/Sk";
export { Sk };

/* ── Skeleton loaders ─────────────────────────────────────────────────────── */

export function OverviewSkeleton() {
  return (
    <>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <Sk className="w-24 h-24 rounded-full flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-3 items-center sm:items-start">
          <div className="flex gap-2">
            <Sk className="h-5 w-16 rounded-full" />
            <Sk className="h-5 w-20 rounded-full" />
          </div>
          <Sk className="h-7 w-44" />
          <Sk className="h-4 w-20" />
          <div className="flex gap-6 mt-1">
            {[1,2,3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Sk className="h-6 w-8" />
                <Sk className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <Sk className="h-9 w-32 rounded-xl flex-shrink-0" />
      </div>
      <div className="dash-card p-4 flex gap-6">
        {[1,2,3].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Sk className="h-6 w-10" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
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
    </>
  );
}

export function AlertsSkeleton() {
  return (
    <>
      <Sk className="h-6 w-56" />
      <Sk className="h-3 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(i => (
          <div key={i} className="dash-card p-5 flex flex-col gap-3">
            <Sk className="h-3 w-12" />
            <Sk className="h-5 w-36" />
            <Sk className="h-4 w-28" />
            <Sk className="h-4 w-20" />
            <Sk className="h-6 w-24 mt-1" />
            <Sk className="h-8 w-full rounded-xl mt-1" />
          </div>
        ))}
      </div>
    </>
  );
}

export function JobsSkeleton() {
  return (
    <>
      <Sk className="h-7 w-44" />
      <div className="flex flex-col gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="dash-card p-5 flex items-center gap-4">
            <Sk className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-48" />
              <div className="flex gap-3">
                <Sk className="h-3 w-16" />
                <Sk className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Sk className="h-5 w-20" />
              <Sk className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function WaiterApplicationsSkeleton() {
  return (
    <>
      <Sk className="h-7 w-36" />
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit">
        {[1,2,3,4].map(i => <Sk key={i} className="h-7 w-20 rounded-lg" />)}
      </div>
      <div className="flex flex-col gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="dash-card p-5 flex items-start gap-4">
            <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-48" />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="h-5 w-20 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}

export function WaiterShiftsSkeleton() {
  return (
    <>
      <div className="flex gap-2 mb-1">
        {[1,2,3].map(i => <Sk key={i} className="h-8 w-24 rounded-xl" />)}
      </div>
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
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
          <div key={i} className="dash-card p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-48" />
            </div>
            <Sk className="h-5 w-16 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}

export function InvitesSkeleton() {
  return (
    <>
      <Sk className="h-7 w-28" />
      <div className="flex flex-col gap-3">
        {[1,2].map(i => (
          <div key={i} className="dash-card p-5 flex items-start gap-4">
            <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Sk className="h-5 w-40" />
              <Sk className="h-3 w-full" />
              <Sk className="h-3 w-3/4" />
              <div className="flex gap-2 mt-1">
                <Sk className="h-8 w-24 rounded-xl" />
                <Sk className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Apply button ─────────────────────────────────────────────────────────── */

export function ApplyButton({ jobId, applied, applying, onApply }: {
  jobId: string; applied: boolean; applying: string | null; onApply: (id: string) => Promise<void>;
}) {
  if (applied) return <div className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-center">✓ Prijavljen</div>;
  return (
    <button onClick={() => onApply(jobId)} disabled={applying === jobId}
      className="btn-dash-orange px-3 py-1.5 text-xs disabled:opacity-50">
      {applying === jobId ? "..." : "Prijavi se"}
    </button>
  );
}

/* ── Market Insights ─────────────────────────────────────────────────────── */

export function MarketInsights() {
  const [data, setData] = useState<MarketData | null>(null);

  useEffect(() => {
    fetch("/api/insights/market")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const salaryLabel = data.avgSalaryMin
    ? `${Math.round(data.avgSalaryMin / 1000)}k${data.avgSalaryMax && data.avgSalaryMax !== data.avgSalaryMin ? `–${Math.round(data.avgSalaryMax / 1000)}k` : ""} RSD`
    : null;

  return (
    <div className="dash-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-wider">Tržište — sada</h3>
      </div>
      <div className="flex gap-6 flex-wrap">
        <div className="text-center">
          <div className="text-xl font-black text-neutral-900">{data.openPositions}</div>
          <div className="text-[10px] text-neutral-400 font-medium">Otvorenih pozicija</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-orange-500">{data.redAlertCount}</div>
          <div className="text-[10px] text-neutral-400 font-medium">Red Alert</div>
        </div>
        {salaryLabel && (
          <div className="text-center">
            <div className="text-xl font-black text-neutral-900">{salaryLabel}</div>
            <div className="text-[10px] text-neutral-400 font-medium">Prosečna plata</div>
          </div>
        )}
      </div>
      {data.topMunicipalities.length > 0 && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          <span className="text-[10px] text-neutral-400 font-medium self-center">Traže:</span>
          {data.topMunicipalities.map(m => (
            <span key={m.name} className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
              {m.name} ({m.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Nav items ────────────────────────────────────────────────────────────── */

export const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview",     label: "Pregled",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "alerts",       label: "Red Alert", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> },
  { key: "jobs",         label: "Poslovi",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { key: "applications", label: "Prijave",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg> },
  { key: "shifts",       label: "Smene",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "invites",      label: "Pozivnice", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  { key: "reviews",      label: "Recenzije", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
  { key: "passport",      label: "Passport",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> },
  { key: "notifications", label: "Obaveštenja", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];
