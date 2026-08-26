"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TrustRadar from "@/components/trust-score/TrustRadar";
import Navbar from "@/components/layout/Navbar";
import Spinner from "@/components/ui/Spinner";
import { ENGAGEMENT_LABELS } from "@/lib/formatting/display-maps";
const TIP_LABELS: Record<string, string> = {
  INDIVIDUAL: "Lični bakšiš", SHARED: "Zajednički fond", VENUE_POLICY: "Politika lokala",
};

type JobDetail = {
  id: string; title: string; description: string;
  engagementType: string; tipSystem: string; tipDescription?: string | null;
  salaryMin?: number | null; salaryMax?: number | null;
  sanitaryRequired: boolean; redAlert: boolean; redAlertNote?: string | null;
  startDate?: string | null; endDate?: string | null;
  applicationDeadline?: string | null; status: string;
  hasApplied: boolean;
  _count: { applications: number };
  venue: {
    id: string; name: string; address: string; municipality: string;
    venueType: string; trustScore: number;
    phone?: string | null; website?: string | null;
    venueTrustScore?: Record<string, number> | null;
  };
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [job, setJob]           = useState<JobDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [applied, setApplied]   = useState(false);
  const [applyErr, setApplyErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const data: JobDetail = await r.json();
        setJob(data);
        setApplied(data.hasApplied);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApply() {
    if (!job) return;
    setApplying(true);
    setApplyErr(null);
    try {
      const res = await fetch("/api/jobs/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPostId: job.id, coverNote: applyNote.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Greška pri prijavi");
      }
      setApplied(true);
      setShowForm(false);
    } catch (e) {
      setApplyErr(e instanceof Error ? e.message : "Neočekivana greška");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen hero-bg">
      <Navbar activePath="/jobs" />
      <Spinner />
    </div>
  );
  if (notFound || !job) return (
    <div className="min-h-screen hero-bg">
      <Navbar activePath="/jobs" />
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="font-black text-xl text-neutral-900 mb-2">Oglas nije pronađen</h2>
          <Link href="/jobs" className="text-orange-500 font-bold hover:underline">← Svi oglasi</Link>
        </div>
      </div>
    </div>
  );

  const salary = job.salaryMin || job.salaryMax
    ? job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString("sr-RS")}–${job.salaryMax.toLocaleString("sr-RS")} RSD`
      : job.salaryMin ? `od ${job.salaryMin.toLocaleString("sr-RS")} RSD` : `do ${job.salaryMax!.toLocaleString("sr-RS")} RSD`
    : "Po dogovoru";

  const isWaiter  = session?.user.role === "WAITER";
  const canApply  = isWaiter && !applied && job.status === "ACTIVE";

  return (
    <div className="min-h-screen hero-bg">
      <Navbar activePath="/jobs" />
      <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
        <Link href="/jobs" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors w-fit">
          ← Svi oglasi
        </Link>

        {/* Red Alert banner */}
        {job.redAlert && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <div className="relative w-4 h-4 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="absolute inset-0 rounded-full bg-red-500" />
            </div>
            <p className="text-sm font-bold text-red-700">{job.redAlertNote ?? "Hitna smena"}</p>
          </div>
        )}

        {/* Main card */}
        <div className="dash-card p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex-1">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                {ENGAGEMENT_LABELS[job.engagementType] ?? job.engagementType}
              </p>
              <h1 className="text-2xl font-black text-neutral-900">{job.title}</h1>
              <Link href={`/venues/${job.venue.id}`} className="text-sm text-neutral-500 hover:text-orange-500 mt-1 inline-block">
                {job.venue.name} · {job.venue.municipality}
              </Link>
            </div>

            {/* Apply / Applied */}
            <div className="flex-shrink-0">
              {applied ? (
                <div className="badge-accepted text-sm font-bold px-4 py-2 rounded-xl">✓ Prijavljen</div>
              ) : canApply ? (
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="btn-dash-orange px-5 py-2.5 text-sm"
                >
                  Prijavi se
                </button>
              ) : !session ? (
                <Link href="/login" className="btn-dash-orange px-5 py-2.5 text-sm inline-block text-center">
                  Prijavi se za nalog
                </Link>
              ) : null}
            </div>
          </div>

          {/* Apply form */}
          {showForm && canApply && (
            <div className="mt-4 border-t border-neutral-100 pt-4 flex flex-col gap-3">
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Propratna poruka (opciono)..."
                rows={3}
                className="auth-input resize-none text-sm"
              />
              {applyErr && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{applyErr}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="btn-dash-outline flex-1 py-2">Otkaži</button>
                <button onClick={handleApply} disabled={applying} className="btn-dash-orange flex-1 py-2 disabled:opacity-50">
                  {applying ? "Šaljem..." : "Potvrdi prijavu"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: "💰", label: "Plata", value: salary + (job.engagementType !== "FULL_TIME" ? "/sm" : "/mes") },
            { icon: "🪙", label: "Bakšiš", value: job.tipDescription?.slice(0, 30) ?? TIP_LABELS[job.tipSystem] },
            { icon: "📋", label: "Sanitarna", value: job.sanitaryRequired ? "Obavezna" : "Nije potrebna" },
            { icon: "👥", label: "Prijava", value: `${job._count.applications} prijava` },
          ].map(({ icon, label, value }) => (
            <div key={label} className="dash-card p-4 text-center">
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">{label}</p>
              <p className="text-sm font-bold text-neutral-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="dash-card p-6">
          <h2 className="font-black text-neutral-900 mb-3">Opis pozicije</h2>
          <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>

        {/* Venue trust radar */}
        {job.venue.venueTrustScore && job.venue.venueTrustScore.composite > 0 && (
          <div className="dash-card p-6">
            <h2 className="font-black text-neutral-900 mb-1">Reputacija lokala</h2>
            <p className="text-sm text-neutral-400 mb-4">{job.venue.name}</p>
            <TrustRadar type="venue" scores={job.venue.venueTrustScore} />
          </div>
        )}
      </div>
    </div>
  );
}
