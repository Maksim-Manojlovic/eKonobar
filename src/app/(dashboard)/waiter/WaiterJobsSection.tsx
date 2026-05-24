"use client";

import { useState } from "react";
import type { JobPost, MyApplication, AppFilter } from "./waiter-types";
import { appStatusKey } from "./waiter-types";
import { ENGAGEMENT_LABELS, formatDate } from "@/lib/display-maps";
import { formatSalary } from "@/lib/format-utils";
import { AlertsSkeleton, JobsSkeleton, WaiterApplicationsSkeleton, ApplyButton, StatusBadge } from "./waiter-helpers";

/* ── Section: Alerts ─────────────────────────────────────────────────────── */

export function AlertsSection({ jobs, loading, onApply, applying, appliedJobIds }: {
  jobs: JobPost[]; loading: boolean; onApply: (id: string) => Promise<void>;
  applying: string | null; appliedJobIds: Set<string>;
}) {
  if (loading) return <AlertsSkeleton />;
  const alerts = jobs.filter(j => j.redAlert);
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative w-4 h-4">
          <span className="pulse-ring w-4 h-4" /><span className="pulse-ring-2 w-4 h-4" />
          <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        </div>
        <h2 className="font-black text-white text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h2>
      </div>
      <p className="text-xs text-neutral-400 -mt-3">Ovi angažmani zahtevaju brzu odluku.</p>
      {alerts.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema hitnih angažmana trenutno</div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map(j => (
              <div key={j.id} className="alert-card p-5">
                <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">⚡ Hitno</div>
                <div className="font-bold text-neutral-900">{j.venue.name}</div>
                <div className="text-sm text-neutral-600 mt-0.5">{j.title}</div>
                <div className="text-xs text-neutral-500 mt-1">{j.venue.municipality}</div>
                <div className="text-lg font-black text-orange-600 mt-3">{formatSalary(j)}</div>
                {j.redAlertNote && <p className="text-xs text-orange-700 mt-1">{j.redAlertNote}</p>}
                <div className="mt-3"><ApplyButton jobId={j.id} applied={appliedJobIds.has(j.id)} applying={applying} onApply={onApply} /></div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Jobs ───────────────────────────────────────────────────────── */

export function JobsSection({ jobs, loading, onApply, applying, appliedJobIds }: {
  jobs: JobPost[]; loading: boolean; onApply: (id: string) => Promise<void>;
  applying: string | null; appliedJobIds: Set<string>;
}) {
  if (loading) return <JobsSkeleton />;
  return (
    <>
      <h2 className="font-black text-white">Dostupni poslovi</h2>
      {jobs.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema dostupnih oglasa</div>
        : <div className="flex flex-col gap-3">
            {jobs.map(j => (
              <div key={j.id} className="dash-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-orange-50 rounded-xl flex-shrink-0 text-xl font-black text-orange-400">
                  {j.venue.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-neutral-900">{j.venue.name}</span>
                    {j.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">⚡ RED</span>}
                  </div>
                  <div className="text-sm text-neutral-500">{j.title}</div>
                  <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                    <span>{ENGAGEMENT_LABELS[j.engagementType] ?? j.engagementType}</span>
                    <span>·</span>
                    <span>{j.venue.municipality}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-orange-500 mb-2">{formatSalary(j)}</div>
                  <ApplyButton jobId={j.id} applied={appliedJobIds.has(j.id)} applying={applying} onApply={onApply} />
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

export function ApplicationsSection({ applications, loading }: { applications: MyApplication[]; loading: boolean }) {
  const [filter, setFilter] = useState<AppFilter>("all");
  if (loading) return <WaiterApplicationsSkeleton />;
  const filtered = filter === "all" ? applications : applications.filter(a => appStatusKey(a.status) === filter);
  const tabs: { key: AppFilter; label: string }[] = [
    { key: "all", label: "Sve" }, { key: "accepted", label: "Prihvaćene" },
    { key: "pending", label: "Na čekanju" }, { key: "rejected", label: "Odbijene" },
  ];
  return (
    <>
      <h2 className="font-black text-white">Moje prijave</h2>
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema prijava</div>
        : <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <div key={a.id} className="dash-card p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-neutral-900">{a.jobPost.venue.name}</div>
                  <div className="text-sm text-neutral-500">{a.jobPost.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{formatDate(a.appliedAt)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
      }
    </>
  );
}
