"use client";

import { useState, useEffect } from "react";
import JobCard, { type JobCardProps } from "@/components/job/JobCard";
import Navbar from "@/components/layout/Navbar";

const ENGAGEMENT_FILTERS = [
  { value: "",            label: "Svi tipovi" },
  { value: "FULL_TIME",   label: "Stalno"     },
  { value: "SEASONAL",    label: "Sezonski"   },
  { value: "WEEKEND",     label: "Vikend"     },
  { value: "CELEBRATION", label: "Slavlje"    },
];

type Job = JobCardProps & { id: string; _count?: { applications: number } };

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [redAlertOnly, setRedAlertOnly] = useState(false);
  const [sanitaryFree, setSanitaryFree] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (redAlertOnly) params.set("redAlert", "true");
    if (typeFilter)   params.set("type", typeFilter);
    if (search)       params.set("search", search);

    setLoading(true);
    fetch(`/api/jobs?${params}`)
      .then((r) => r.json())
      .then((data: Job[]) => setJobs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [redAlertOnly, typeFilter, search]);

  const filtered = sanitaryFree ? jobs.filter((j) => !j.sanitaryRequired) : jobs;

  return (
    <div className="min-h-screen hero-bg">
      <Navbar activePath="/jobs" />
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Oglasi</p>
          <h1 className="text-3xl font-black text-neutral-900">Oglasi za posao</h1>
          <p className="text-neutral-500 mt-1">Aktivni oglasi u ugostiteljstvu</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži oglase..."
            className="auth-input"
          />
          <div className="flex flex-wrap gap-2 items-center">
            {ENGAGEMENT_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  typeFilter === value
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => setRedAlertOnly((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                redAlertOnly
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-red-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${redAlertOnly ? "bg-white" : "bg-red-500"}`} />
              Red Alert
            </button>

            <button
              onClick={() => setSanitaryFree((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                sanitaryFree
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
              }`}
            >
              📋 Bez sanitarne
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-neutral-500 font-medium">
              Nema oglasa koji odgovaraju filteru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((j) => (
              <JobCard
                key={j.id}
                {...j}
                applicationCount={j._count?.applications}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
