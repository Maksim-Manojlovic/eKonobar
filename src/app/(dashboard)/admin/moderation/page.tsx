"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Review = {
  id: string;
  direction: string;
  status: string;
  overallRating: number;
  comment: string | null;
  createdAt: string;
  publishedAt: string | null;
  author: { id: string; name: string | null; email: string; verificationTier: string };
  venue: { id: string; name: string; municipality: string } | null;
  subject: { id: string; name: string | null } | null;
};

const DIRECTION_LABELS: Record<string, string> = {
  WAITER_TO_VENUE:  "Konobar → Lokal",
  VENUE_TO_WAITER:  "Lokal → Konobar",
  GUEST_TO_WAITER:  "Gost → Konobar",
};

const TIER_COLORS: Record<string, string> = {
  ID_VERIFIED: "text-purple-700 bg-purple-50 border-purple-300",
  GOLD:        "text-amber-700  bg-amber-50  border-amber-300",
  SILVER:      "text-slate-600  bg-slate-50  border-slate-300",
  UNVERIFIED:  "text-neutral-500 bg-neutral-50 border-neutral-300",
};

function Stars({ rating }: { rating: number }) {
  const stars = Math.round(rating / 20);
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminModerationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/reviews")
      .then((r) => r.json())
      .then((d) => setReviews(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  async function handleAction(id: string, action: "publish" | "remove") {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setActing(null);
    }
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Admin</Link>
          </div>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Admin</p>
          <h1 className="text-2xl font-black text-neutral-900">Moderacija recenzija</h1>
          <p className="text-sm text-neutral-500">{reviews.length} spornih recenzija</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
        )}

        {reviews.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-neutral-900">Nema spornih recenzija.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <div key={review.id} className="dash-card p-5">
                {/* Direction + rating row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700">
                      {DIRECTION_LABELS[review.direction] ?? review.direction}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700">
                      SPORNA
                    </span>
                  </div>
                  <Stars rating={review.overallRating} />
                </div>

                {/* Target */}
                <div className="text-xs text-neutral-500 mb-2">
                  {review.venue && <span>Lokal: <strong>{review.venue.name}</strong> ({review.venue.municipality})</span>}
                  {review.subject && <span>Konobar: <strong>{review.subject.name ?? "—"}</strong></span>}
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm text-neutral-700 leading-relaxed mb-3 italic">&ldquo;{review.comment}&rdquo;</p>
                )}

                {/* Author row */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_COLORS[review.author.verificationTier] ?? TIER_COLORS.UNVERIFIED}`}>
                    {review.author.verificationTier.replace("_", " ")}
                  </span>
                  <span className="text-xs text-neutral-500">{review.author.name ?? review.author.email}</span>
                  <span className="text-xs text-neutral-400">· {formatDate(review.createdAt)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(review.id, "publish")}
                    disabled={acting === review.id}
                    className="btn-dash-orange px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {acting === review.id ? "..." : "Objavi"}
                  </button>
                  <button
                    onClick={() => handleAction(review.id, "remove")}
                    disabled={acting === review.id}
                    className="text-xs font-bold px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    {acting === review.id ? "..." : "Ukloni"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
