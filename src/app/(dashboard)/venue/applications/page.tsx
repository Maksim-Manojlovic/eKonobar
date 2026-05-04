"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewWizard from "@/components/review/ReviewWizard";

type Application = {
  id: string;
  status: string;
  appliedAt: string;
  jobPost: { id: string; title: string; venueId: string };
  waiter: {
    id: string;
    name: string | null;
    verificationTier: string;
    waiterPassport: {
      score: number;
      badges: string[];
      sanitaryBookValid: boolean;
      currentlyAvailable: boolean;
    } | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Na čekanju", SHORTLISTED: "Shortlist",
  ACCEPTED: "Prihvaćeno", REJECTED: "Odbijeno",
  COMPLETED: "Završeno", WITHDRAWN: "Povučena",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "badge-pending",
  SHORTLISTED: "text-blue-700 bg-blue-50 border border-blue-200",
  ACCEPTED:    "badge-accepted",
  COMPLETED:   "badge-accepted",
  REJECTED:    "badge-rejected",
  WITHDRAWN:   "badge-rejected",
};

const TIER_COLORS: Record<string, string> = {
  ID_VERIFIED: "text-purple-700 bg-purple-50 border-purple-300",
  GOLD:        "text-amber-700 bg-amber-50 border-amber-300",
  SILVER:      "text-slate-600 bg-slate-50 border-slate-300",
  UNVERIFIED:  "text-neutral-500 bg-neutral-50 border-neutral-300",
};

type Filter = "SVE" | "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED" | "COMPLETED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "SVE",         label: "Sve" },
  { key: "PENDING",     label: "Na čekanju" },
  { key: "SHORTLISTED", label: "Shortlist" },
  { key: "ACCEPTED",    label: "Prihvaćene" },
  { key: "REJECTED",    label: "Odbijene" },
  { key: "COMPLETED",   label: "Završene" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" });
}

export default function VenueApplicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [apps, setApps]         = useState<Application[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("SVE");
  const [updating, setUpdating] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "VENUE_OWNER") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/jobs/applications")
      .then(r => r.json())
      .then(d => setApps(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    const res = await fetch(`/api/jobs/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
    setUpdating(null);
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const filtered = filter === "SVE" ? apps : apps.filter(a => a.status === filter);

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/venue" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
          </div>
          <h1 className="text-2xl font-black text-neutral-900">Prijave na oglase</h1>
          <p className="text-sm text-neutral-500">{apps.length} ukupno · {apps.filter(a => a.status === "PENDING").length} na čekanju</p>
        </div>

        {/* Filter tabs */}
        <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === f.key ? "active" : "text-neutral-500"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema prijava za ovaj filter.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(app => {
              const p = app.waiter.waiterPassport;
              return (
                <div key={app.id} className="dash-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center flex-shrink-0">
                        {app.waiter.name ? app.waiter.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-neutral-900 text-sm">{app.waiter.name ?? "Konobar"}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_COLORS[app.waiter.verificationTier] ?? TIER_COLORS.UNVERIFIED}`}>
                            {app.waiter.verificationTier.replace("_", " ")}
                          </span>
                          {p && (
                            <span className="text-xs font-black text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                              {Math.round(p.score)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">{app.jobPost.title} · {formatDate(app.appliedAt)}</p>
                        {p && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {p.sanitaryBookValid && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">📋 Sanitarna</span>}
                            {p.currentlyAvailable && <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Dostupan</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? ""}`}>
                        {STATUS_LABELS[app.status] ?? app.status}
                      </span>
                      {app.status === "PENDING" && (
                        <div className="flex gap-1.5">
                          <button onClick={() => updateStatus(app.id, "SHORTLISTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">
                            Shortlist
                          </button>
                          <button onClick={() => updateStatus(app.id, "ACCEPTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                            Prihvati
                          </button>
                          <button onClick={() => updateStatus(app.id, "REJECTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                            Odbij
                          </button>
                        </div>
                      )}
                      {app.status === "SHORTLISTED" && (
                        <div className="flex gap-1.5">
                          <button onClick={() => updateStatus(app.id, "ACCEPTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                            Prihvati
                          </button>
                          <button onClick={() => updateStatus(app.id, "REJECTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                            Odbij
                          </button>
                        </div>
                      )}
                      {app.status === "ACCEPTED" && (
                        <div className="flex gap-1.5">
                          <button onClick={() => updateStatus(app.id, "COMPLETED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                            Završi angažman
                          </button>
                          <button onClick={() => updateStatus(app.id, "REJECTED")} disabled={updating === app.id}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                            Odbij
                          </button>
                        </div>
                      )}
                      {app.status === "COMPLETED" && !reviewedIds.has(app.id) && (
                        <button
                          onClick={() => setReviewApp(app)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                        >
                          Oceni konobara
                        </button>
                      )}
                      {app.status === "COMPLETED" && reviewedIds.has(app.id) && (
                        <span className="text-[11px] font-medium text-green-600">✓ Ocenjeno</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewApp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setReviewApp(null)}>
          <div onClick={e => e.stopPropagation()}>
            <ReviewWizard
              direction="VENUE_TO_WAITER"
              subjectId={reviewApp.waiter.id}
              subjectName={reviewApp.waiter.name ?? undefined}
              venueId={reviewApp.jobPost.venueId}
              onSuccess={() => {
                setReviewedIds(prev => new Set([...prev, reviewApp.id]));
                setReviewApp(null);
              }}
              onCancel={() => setReviewApp(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
