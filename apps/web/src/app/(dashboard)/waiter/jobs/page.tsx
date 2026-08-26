"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS_WAITER,
  ENGAGEMENT_LABELS,
  formatDate,
} from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";

type JobPost = {
  id: string;
  title: string;
  description: string;
  engagementType: string;
  tipSystem: string;
  salaryMin: number | null;
  salaryMax: number | null;
  sanitaryRequired: boolean;
  redAlert: boolean;
  redAlertNote: string | null;
  applicationDeadline: string | null;
  createdAt: string;
  venue: {
    id: string;
    name: string;
    address: string;
    municipality: string;
    trustScore: number;
  };
  _count: { applications: number };
};

type Application = { jobPostId: string; status: string };

type EngFilter = "SVE" | "FULL_TIME" | "SEASONAL" | "WEEKEND" | "CELEBRATION";


const TIP_LABELS: Record<string, string> = {
  SHARED: "Napojnice deljene", INDIVIDUAL: "Lične napojnice", NONE: "Bez napojnica",
};

const FILTERS: { key: EngFilter; label: string }[] = [
  { key: "SVE",         label: "Sve" },
  { key: "FULL_TIME",   label: "Stalno" },
  { key: "SEASONAL",    label: "Sezonski" },
  { key: "WEEKEND",     label: "Vikend" },
  { key: "CELEBRATION", label: "Slavlje" },
];

function TrustDot({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 45 ? "#d97706" : "#dc2626";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {score}
    </span>
  );
}

import { useRequireRole } from "@/hooks/useRequireRole";
export default function WaiterJobsPage() {
  const { status } = useRequireRole("WAITER");

  const [jobs, setJobs]             = useState<JobPost[]>([]);
  const [myApps, setMyApps]         = useState<Application[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [engFilter, setEngFilter]   = useState<EngFilter>("SVE");
  const [redOnly, setRedOnly]       = useState(false);
  const [applyJob, setApplyJob]     = useState<JobPost | null>(null);
  const [coverNote, setCoverNote]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const params = new URLSearchParams();
    if (search)                   params.set("search", search);
    if (engFilter !== "SVE")      params.set("type", engFilter);
    if (redOnly)                  params.set("redAlert", "true");

    Promise.all([
      fetch(`/api/jobs?${params}`).then(r => r.json()),
      fetch("/api/jobs/applications").then(r => r.json()),
    ]).then(([postsData, appsData]) => {
      setJobs(Array.isArray(postsData) ? postsData : []);
      setMyApps(Array.isArray(appsData) ? appsData : []);
    }).finally(() => setLoading(false));
  }, [status, search, engFilter, redOnly]);

  const appliedMap = useMemo(() => {
    const m: Record<string, string> = {};
    myApps.forEach(a => { m[a.jobPostId] = a.status; });
    return m;
  }, [myApps]);

  async function handleApply() {
    if (!applyJob) return;
    setSubmitting(true);
    setApplyError(null);
    const res = await fetch("/api/jobs/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPostId: applyJob.id, coverNote: coverNote || undefined }),
    });
    if (res.ok) {
      setMyApps(prev => [...prev, { jobPostId: applyJob.id, status: "PENDING" }]);
      setApplyJob(null);
      setCoverNote("");
    } else {
      const d = await res.json();
      setApplyError(d.error ?? "Greška pri prijavi.");
    }
    setSubmitting(false);
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <div className="mb-1">
              <Link href="/waiter" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Oglasi za posao</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{jobs.length} aktivan{jobs.length === 1 ? "" : "a"} oglas{jobs.length === 1 ? "" : "a"}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Pretraži oglase..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
          <div className="flex flex-wrap gap-2 items-center">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setEngFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  engFilter === f.key
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setRedOnly(p => !p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                redOnly
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-red-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${redOnly ? "bg-white" : "bg-red-500"}`} />
              Red Alert
            </button>
          </div>
        </div>

        {/* Job list */}
        {jobs.length === 0 ? (
          <div className="text-center py-20 text-neutral-400 text-sm">Nema oglasa za prikazane filtere.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map(job => {
              const appStatus = appliedMap[job.id];
              const isExpanded = expanded === job.id;

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {job.redAlert && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              RED ALERT
                            </span>
                          )}
                          <span className="text-xs font-medium text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5 bg-neutral-50">
                            {ENGAGEMENT_LABELS[job.engagementType] ?? job.engagementType}
                          </span>
                          {job.sanitaryRequired && (
                            <span className="text-xs font-medium text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 bg-blue-50">
                              Sanitarna knj.
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-neutral-900 leading-tight">{job.title}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-neutral-600 font-medium">{job.venue.name}</span>
                          <span className="text-neutral-300">·</span>
                          <span className="text-xs text-neutral-400">{job.venue.municipality}</span>
                          <span className="text-neutral-300">·</span>
                          <TrustDot score={job.venue.trustScore} />
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-sm font-bold text-neutral-800">{formatSalary(job)}</p>
                        <p className="text-xs text-neutral-400">{TIP_LABELS[job.tipSystem] ?? job.tipSystem}</p>
                      </div>
                    </div>

                    {/* Red alert note */}
                    {job.redAlert && job.redAlertNote && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                        {job.redAlertNote}
                      </div>
                    )}

                    {/* Expanded description */}
                    {isExpanded && (
                      <p className="mt-3 text-sm text-neutral-600 leading-relaxed">{job.description}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3 justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpanded(isExpanded ? null : job.id)}
                          className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                        >
                          {isExpanded ? "Sakrij opis" : "Prikaži opis"}
                        </button>
                        <span className="text-xs text-neutral-400">
                          {job._count.applications} prijav{job._count.applications === 1 ? "a" : "e"}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {formatDate(job.createdAt)}
                        </span>
                        {job.applicationDeadline && (
                          <span className="text-xs text-amber-600 font-medium">
                            Rok: {formatDate(job.applicationDeadline)}
                          </span>
                        )}
                      </div>

                      {appStatus ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${APPLICATION_STATUS_COLORS[appStatus] ?? "text-neutral-500 bg-neutral-50 border-neutral-200"}`}>
                          {APPLICATION_STATUS_LABELS_WAITER[appStatus] ?? appStatus}
                        </span>
                      ) : (
                        <button
                          onClick={() => { setApplyJob(job); setApplyError(null); setCoverNote(""); }}
                          className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors"
                        >
                          Prijavi se
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply modal */}
      {applyJob && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setApplyJob(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-neutral-900 mb-1">Prijava za oglas</h2>
            <p className="text-sm text-neutral-500 mb-4">
              <span className="font-semibold text-neutral-700">{applyJob.title}</span> · {applyJob.venue.name}
            </p>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Propratna poruka <span className="font-normal text-neutral-400">(opciono)</span></label>
            <textarea
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
              rows={4}
              placeholder="Kratko se predstavi ili napomeni nešto relevantno..."
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            />
            {applyError && <p className="text-xs text-red-600 mt-2">{applyError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setApplyJob(null)}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={handleApply}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {submitting ? "Šalje se..." : "Prijavi se"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
