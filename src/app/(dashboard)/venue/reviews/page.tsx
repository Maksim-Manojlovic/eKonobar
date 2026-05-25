"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { VERIFICATION_TIER_COLORS, formatDate } from "@/lib/formatting/display-maps";

type Venue = { id: string; name: string };

type Review = {
  id: string;
  direction: string;
  overallRating: number;
  comment: string | null;
  publishedAt: string | null;
  author: { id: string; name: string | null; verificationTier: string };
  ratingAtmosphere: number | null;
  ratingOrganization: number | null;
  ratingPay: number | null;
  ratingTips: number | null;
  ratingHygieneWork: number | null;
  ratingManagement: number | null;
};

const DIM_LABELS = [
  { key: "ratingAtmosphere",   label: "Atmosfera" },
  { key: "ratingOrganization", label: "Organizacija" },
  { key: "ratingPay",          label: "Plata" },
  { key: "ratingTips",         label: "Napojnice" },
  { key: "ratingHygieneWork",  label: "Higijena" },
  { key: "ratingManagement",   label: "Menadžment" },
] as const;

function Stars({ rating }: { rating: number }) {
  const stars = Math.round(rating / 20);
  return <span className="text-amber-400 text-sm">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>;
}

import { useRequireRole } from "@/hooks/useRequireRole";
export default function VenueReviewsPage() {
  const { status } = useRequireRole("VENUE_OWNER");

  const [venues, setVenues]     = useState<Venue[]>([]);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeVenue, setActiveVenue] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/venues")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setVenues(d);
          setActiveVenue(d[0].id);
        }
        setLoading(false);
      });
  }, [status]);

  useEffect(() => {
    if (!activeVenue) return;
    fetch(`/api/reviews?venueId=${activeVenue}`)
      .then(r => r.json())
      .then(d => setReviews(Array.isArray(d) ? d : []));
  }, [activeVenue]);

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const avgRating = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length / 20 * 10) / 10
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/venue" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
          </div>
          <h1 className="text-2xl font-black text-neutral-900">Recenzije osoblja</h1>
          {reviews.length > 0 && (
            <p className="text-sm text-neutral-500">{reviews.length} recenzija · prosek {avgRating}★</p>
          )}
        </div>

        {/* Venue tabs (if multiple) */}
        {venues.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {venues.map(v => (
              <button key={v.id} onClick={() => setActiveVenue(v.id)}
                className={`text-sm font-semibold px-4 py-1.5 rounded-xl border transition-all ${activeVenue === v.id ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"}`}>
                {v.name}
              </button>
            ))}
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">⭐</p>
            <p className="font-bold text-neutral-900">Nema recenzija za ovaj lokal.</p>
            <p className="text-sm text-neutral-500 mt-1">Recenzije pišu konobari koji su radili u lokalu.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map(r => (
              <div key={r.id} className="dash-card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_TIER_COLORS[r.author.verificationTier] ?? VERIFICATION_TIER_COLORS.UNVERIFIED}`}>
                      {r.author.verificationTier.replace("_", " ")}
                    </span>
                    <span className="text-sm font-semibold text-neutral-700">{r.author.name ?? "Konobar"}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Stars rating={r.overallRating} />
                    {r.publishedAt && <span className="text-xs text-neutral-400">{formatDate(r.publishedAt)}</span>}
                  </div>
                </div>

                {r.comment && (
                  <p className="text-sm text-neutral-700 leading-relaxed mb-3 italic">&ldquo;{r.comment}&rdquo;</p>
                )}

                {/* Dimension bars */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DIM_LABELS.map(({ key, label }) => {
                    const val = r[key];
                    if (val == null) return null;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-neutral-400">{label}</span>
                          <span className="font-bold text-neutral-600">{Math.round(val / 20 * 10) / 10}</span>
                        </div>
                        <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-300 rounded-full" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
