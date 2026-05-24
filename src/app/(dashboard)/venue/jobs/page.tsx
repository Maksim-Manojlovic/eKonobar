"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, ENGAGEMENT_LABELS } from "@/lib/display-maps";
import { formatSalary } from "@/lib/format-utils";

type JobPost = {
  id: string;
  title: string;
  engagementType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  redAlert: boolean;
  status: string;
  createdAt: string;
  venue: { id: string; name: string };
  _count: { applications: number };
};


import { useRequireRole } from "@/hooks/useRequireRole";
export default function VenueJobsPage() {
  const { status } = useRequireRole("VENUE_OWNER");

  const [jobs, setJobs]       = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/jobs")
      .then(r => r.json())
      .then(d => setJobs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const active = jobs.filter(j => j.status === "ACTIVE").length;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/venue" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
            </div>
            <h1 className="text-2xl font-black text-neutral-900">Moji oglasi</h1>
            <p className="text-sm text-neutral-500">{active} aktivnih od {jobs.length} ukupno</p>
          </div>
          <Link href="/venue/jobs/new" className="btn-dash-orange px-5 py-2.5 text-sm">
            + Novi oglas
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-neutral-900">Nema oglasa. Kreiraj prvi oglas.</p>
            <Link href="/venue/jobs/new" className="btn-dash-orange px-6 py-2.5 text-sm inline-block mt-4">Kreiraj oglas</Link>
          </div>
        ) : (
          <div className="dash-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  {["Oglas", "Tip", "Plata", "Prijave", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {j.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">⚡ RED</span>}
                        <div>
                          <p className="font-bold text-neutral-900 text-sm">{j.title}</p>
                          <p className="text-xs text-neutral-400">{j.venue.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{ENGAGEMENT_LABELS[j.engagementType] ?? j.engagementType}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-700">{formatSalary(j)}</td>
                    <td className="px-4 py-3">
                      <Link href="/venue/applications" className="text-sm font-bold text-orange-500 hover:underline">
                        {j._count.applications}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${JOB_STATUS_COLORS[j.status] ?? "text-neutral-500 bg-neutral-50 border-neutral-300"}`}>
                        {JOB_STATUS_LABELS[j.status] ?? j.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
