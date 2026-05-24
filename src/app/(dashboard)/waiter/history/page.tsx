"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewWizard from "@/components/review/ReviewWizard";
import { ENGAGEMENT_LABELS } from "@/lib/display-maps";

type Engagement = {
  id: string;
  venueId: string;
  venueName: string;
  venueType: string;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  verified: boolean;
  engagementType: string;
};

const VENUE_TYPE_ICONS: Record<string, string> = {
  RESTAURANT: "🍽️", BAR: "🍺", CAFE: "☕", NIGHTCLUB: "🎵",
  HOTEL: "🏨", CATERING: "🍱", OTHER: "🏢",
};


function formatPeriod(start: string, end: string | null): string {
  const s = new Date(start).toLocaleDateString("sr-Latn-RS", { month: "short", year: "numeric" });
  if (!end) return `${s} — sada`;
  const e = new Date(end).toLocaleDateString("sr-Latn-RS", { month: "short", year: "numeric" });
  return `${s} — ${e}`;
}

export default function WaiterHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [reviewTarget, setReviewTarget] = useState<{ venueId: string; venueName: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "WAITER") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/passport/engagements")
      .then(r => r.json())
      .then(d => setEngagements(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <Link href="/waiter" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
          <h1 className="font-black text-2xl text-neutral-900">Istorija angažmana</h1>
        </div>

        {engagements.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-neutral-900">Nema evidentiranih angažmana.</p>
            <p className="text-sm text-neutral-500 mt-1">Angažmani se dodaju kada vlasnik lokala označi posao kao završen.</p>
          </div>
        ) : (
          <div className="dash-card p-5">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-100" />
              <div className="flex flex-col gap-0">
                {engagements.map((eng, i) => (
                  <div key={eng.id} className="relative flex gap-5 pb-6 last:pb-0">
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm
                      ${eng.verified ? "bg-green-100 border-2 border-green-400" : "bg-neutral-100 border-2 border-neutral-300"}`}>
                      {VENUE_TYPE_ICONS[eng.venueType] ?? "🏢"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900 text-sm">{eng.venueName}</span>
                        {eng.verified && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">✓ Verifikovano</span>
                        )}
                      </div>
                      {eng.notes && <p className="text-xs text-neutral-600 mt-0.5">{eng.notes}</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                        <span>{formatPeriod(eng.startDate, eng.endDate)}</span>
                        {eng.engagementType && (
                          <>
                            <span>·</span>
                            <span>{ENGAGEMENT_LABELS[eng.engagementType] ?? eng.engagementType}</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => setReviewTarget({ venueId: eng.venueId, venueName: eng.venueName })}
                        className="mt-1.5 text-[11px] font-semibold text-orange-500 hover:text-orange-700 transition-colors"
                      >
                        Ostavi recenziju →
                      </button>
                    </div>
                    {i < engagements.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-0 w-px bg-neutral-100" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-400 text-center">
          Ukupno {engagements.length} angažmana · {engagements.filter(e => e.verified).length} verifikovano
        </p>
      </div>

      {reviewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setReviewTarget(null); }}
        >
          <ReviewWizard
            direction="WAITER_TO_VENUE"
            venueId={reviewTarget.venueId}
            venueName={reviewTarget.venueName}
            onSuccess={() => setReviewTarget(null)}
            onCancel={() => setReviewTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
