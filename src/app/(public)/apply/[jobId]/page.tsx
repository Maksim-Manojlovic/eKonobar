"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import { ENGAGEMENT_LABELS } from "@/lib/display-maps";

type JobSummary = {
  id: string; title: string; engagementType: string;
  salaryMin?: number | null; salaryMax?: number | null;
  sanitaryRequired: boolean; redAlert: boolean; redAlertNote?: string | null;
  status: string; hasApplied: boolean;
  venue: { id: string; name: string; municipality: string };
};

export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [job, setJob]           = useState<JobSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const data: JobSummary = await r.json();
        setJob(data);
        if (data.hasApplied) setDone(true);
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  // Redirect non-waiters to login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/apply/${jobId}`);
    }
    if (status === "authenticated" && session?.user.role !== "WAITER") {
      router.push("/");
    }
  }, [status, session, router, jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPostId: job.id, coverNote: coverNote.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Greška pri prijavi");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neočekivana greška");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || loading) {
    return <div className="min-h-screen hero-bg"><Spinner /></div>;
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="font-black text-xl text-neutral-900 mb-2">Oglas nije pronađen</h2>
          <Link href="/jobs" className="text-orange-500 font-bold hover:underline">← Svi oglasi</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="dash-card p-10 max-w-md w-full text-center flex flex-col gap-4">
          <div className="text-5xl">✅</div>
          <h2 className="font-black text-2xl text-neutral-900">Prijava poslata!</h2>
          <p className="text-neutral-500 text-sm">
            Prijavili ste se na oglas <strong>{job.title}</strong> u {job.venue.name}.
            Vlasnik lokala će pregledati vašu prijavu.
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/jobs" className="btn-dash-outline flex-1 py-2.5 text-sm text-center">
              ← Oglasi
            </Link>
            <Link href="/waiter" className="btn-dash-orange flex-1 py-2.5 text-sm text-center">
              Moj dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (job.status !== "ACTIVE") {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">⏸️</p>
          <h2 className="font-black text-xl text-neutral-900 mb-2">Oglas nije aktivan</h2>
          <Link href="/jobs" className="text-orange-500 font-bold hover:underline">← Svi oglasi</Link>
        </div>
      </div>
    );
  }

  const salary = job.salaryMin || job.salaryMax
    ? job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString("sr-RS")}–${job.salaryMax.toLocaleString("sr-RS")} RSD`
      : job.salaryMin
        ? `od ${job.salaryMin.toLocaleString("sr-RS")} RSD`
        : `do ${job.salaryMax!.toLocaleString("sr-RS")} RSD`
    : "Po dogovoru";

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full flex flex-col gap-5">
        <Link href={`/jobs/${job.id}`} className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors w-fit">
          ← Detalji oglasa
        </Link>

        {/* Job summary */}
        <div className="dash-card p-5">
          {job.redAlert && (
            <div className="flex items-center gap-2 mb-3 text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold">{job.redAlertNote ?? "Hitna smena"}</span>
            </div>
          )}
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">
            {ENGAGEMENT_LABELS[job.engagementType] ?? job.engagementType}
          </p>
          <h1 className="text-xl font-black text-neutral-900 mt-0.5">{job.title}</h1>
          <p className="text-sm text-neutral-500">{job.venue.name} · {job.venue.municipality}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs font-semibold text-neutral-600 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
              {salary}
            </span>
            {job.sanitaryRequired && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                📋 Sanitarna obavezna
              </span>
            )}
          </div>
        </div>

        {/* Application form */}
        <form onSubmit={handleSubmit} className="dash-card p-6 flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">Prijava</p>
            <h2 className="font-black text-lg text-neutral-900">Propratna poruka</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Opciono — kratko predstavi sebe vlasniku lokala.</p>
          </div>

          <textarea
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder={`Zdravo, zainteresovan/a sam za poziciju ${job.title}...`}
            rows={5}
            maxLength={800}
            className="auth-input resize-none text-sm"
          />
          <p className="text-xs text-neutral-400 text-right -mt-2">{coverNote.length}/800</p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-dash-orange py-3 w-full disabled:opacity-50 text-sm"
          >
            {submitting ? "Šaljem prijavu..." : "Pošalji prijavu"}
          </button>
        </form>
      </div>
    </div>
  );
}
