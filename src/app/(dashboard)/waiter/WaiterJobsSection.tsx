"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { JobPost, MyApplication, AppFilter, InviteItem, Section } from "./waiter-types";
import { InvitesSection } from "./WaiterInvitesSection";
import { ENGAGEMENT_LABELS, formatDate } from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";
import { AlertsSkeleton, JobsSkeleton, WaiterApplicationsSkeleton, ApplyButton, StatusBadge, appStatusKey } from "./waiter-helpers";

// mapbox-gl is browser-only — load the map component client-side, same as /jobs.
const MapSearch = dynamic(() => import("@/components/map/MapSearch"), { ssr: false });

/* ── Section: Alerts ─────────────────────────────────────────────────────── */

export function AlertsSection({ jobs, loading, onApply, applying, appliedJobIds }: {
  jobs: JobPost[]; loading: boolean; onApply: (id: string) => Promise<void>;
  applying: string | null; appliedJobIds: Set<string>;
}) {
  if (loading) return <AlertsSkeleton />;
  const alerts = jobs.filter(j => j.redAlert);
  return (
    <>
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
  const [view, setView] = useState<"list" | "map">("list");
  if (loading) return <JobsSkeleton />;
  return (
    <>
      {/* Lista / Mapa — the map shows where work is across the city, so a waiter
          can eyeball which posts are near where they'll travel. */}
      <div className="bg-white/5 rounded-xl p-1 flex gap-1 w-fit">
        {(["list", "map"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
              view === v ? "bg-orange-500 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}>
            {v === "list" ? "Lista" : "Mapa"}
          </button>
        ))}
      </div>

      {view === "map"
        ? <MapSearch mode="jobs" />
        : jobs.length === 0
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

/* ── Hub: Poslovi ────────────────────────────────────────────────────────── */

const POSLOVI_TABS: { key: Section; label: string }[] = [
  { key: "alerts",       label: "Red Alert" },
  { key: "jobs",         label: "Oglasi" },
  { key: "applications", label: "Prijave" },
  { key: "invites",      label: "Pozivnice" },
];

export function PosloviHub({ section, jobs, applications, invites, loading, onApply, applying, appliedJobIds, onRespond, onNavigate }: {
  section: Section;
  jobs: JobPost[];
  applications: MyApplication[];
  invites: InviteItem[];
  loading: boolean;
  onApply: (id: string) => Promise<void>;
  applying: string | null;
  appliedJobIds: Set<string>;
  onRespond: (id: string, status: "ACCEPTED" | "DECLINED") => Promise<void>;
  onNavigate: (s: Section) => void;
}) {
  const alertCount  = jobs.filter(j => j.redAlert).length;
  const inviteCount = invites.filter(i => i.status === "PENDING").length;
  const activeTab   = POSLOVI_TABS.find(t => t.key === section)?.key ?? "jobs";

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/5 rounded-xl p-1 flex gap-1">
        {POSLOVI_TABS.map(t => (
          <button key={t.key} onClick={() => onNavigate(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === t.key
                ? "bg-orange-500 text-white shadow-sm"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}>
            {t.label}
            {t.key === "alerts" && alertCount > 0 && (
              <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                activeTab === "alerts" ? "bg-white text-orange-500" : "bg-orange-500 text-white"
              }`}>{alertCount}</span>
            )}
            {t.key === "invites" && inviteCount > 0 && (
              <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                activeTab === "invites" ? "bg-white text-orange-500" : "bg-orange-500 text-white"
              }`}>{inviteCount}</span>
            )}
          </button>
        ))}
      </div>
      {activeTab === "alerts"       && <AlertsSection jobs={jobs} loading={loading} onApply={onApply} applying={applying} appliedJobIds={appliedJobIds} />}
      {activeTab === "jobs"         && <JobsSection jobs={jobs} loading={loading} onApply={onApply} applying={applying} appliedJobIds={appliedJobIds} />}
      {activeTab === "applications" && <ApplicationsSection applications={applications} loading={loading} />}
      {activeTab === "invites"      && <InvitesSection invites={invites} loading={loading} onRespond={onRespond} />}
    </div>
  );
}
