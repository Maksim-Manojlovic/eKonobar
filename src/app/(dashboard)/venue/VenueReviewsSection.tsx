"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useReviewModeration } from "@/hooks/useReviewModeration";
import type { Venue, VenueReview, Section } from "./venue-types";
import { formatDate } from "@/lib/formatting/display-maps";
import { ReviewsSkeleton } from "./venue-helpers";

/* ── Shared display helpers ──────────────────────────────────────────────── */

export function ReviewStatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Čeka objavu</span>;
  if (status === "DISPUTED")
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sporno</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Objavljeno</span>;
}

export function starsText(rating: number): string {
  const n = Math.round(rating / 20);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/* ── ModerationButtons ───────────────────────────────────────────────────── */

function ModerationButtons({
  reviewId,
  moderating,
  onModerate,
}: {
  reviewId: string;
  moderating: string | null;
  onModerate: (id: string, action: "approve" | "reject") => void;
}) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        disabled={moderating === reviewId}
        onClick={() => onModerate(reviewId, "approve")}
        className="text-xs font-semibold px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
      >
        {moderating === reviewId ? "..." : "Objavi"}
      </button>
      <button
        disabled={moderating === reviewId}
        onClick={() => onModerate(reviewId, "reject")}
        className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
      >
        Odbaci
      </button>
    </div>
  );
}

/* ── ReviewsSection (waiter → venue) ────────────────────────────────────── */

export function ReviewsSection({ venue }: { venue: Venue | null }) {
  const [reviews, setReviews]   = useState<VenueReview[]>([]);
  const [loadingR, setLoadingR] = useState(true);
  const { moderating, handleModerate } = useReviewModeration(setReviews);

  useEffect(() => {
    if (!venue) { setLoadingR(false); return; }
    fetch(`/api/venues/${venue.id}/reviews`)
      .then(r => r.ok ? r.json() : [])
      .then((data: VenueReview[]) => {
        setReviews(data.filter(r => r.direction === "WAITER_TO_VENUE" && r.status !== "REMOVED"));
        setLoadingR(false);
      })
      .catch(() => setLoadingR(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.id]);

  return (
    <>
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-neutral-900 text-sm">Recenzije konobara o lokalu</h3>
          {!loadingR && <span className="text-xs text-neutral-400">{reviews.length} primljeno</span>}
        </div>

        {loadingR ? (
          <ReviewsSkeleton />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">Još nema recenzija konobara.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map(r => (
              <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-neutral-900 text-sm">{r.author?.name ?? "Konobar"}</span>
                    <ReviewStatusBadge status={r.status} />
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{formatDate(r.createdAt)}</span>
                </div>
                <div className="text-orange-400 text-sm tracking-wide mb-1">{starsText(r.overallRating)}</div>
                {r.comment && <p className="text-sm text-neutral-600 leading-relaxed">{r.comment}</p>}
                {(r.ratingAtmosphere || r.ratingOrganization || r.ratingHygieneWork) && (
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {r.ratingAtmosphere   && <span className="text-xs text-neutral-400">Atmosfera {starsText(r.ratingAtmosphere)}</span>}
                    {r.ratingOrganization && <span className="text-xs text-neutral-400">Organizacija {starsText(r.ratingOrganization)}</span>}
                    {r.ratingHygieneWork  && <span className="text-xs text-neutral-400">Higijena {starsText(r.ratingHygieneWork)}</span>}
                  </div>
                )}
                {r.status === "PENDING" && (
                  <ModerationButtons reviewId={r.id} moderating={moderating} onModerate={handleModerate} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── QrReviewSection (guest → venue / guest → waiter) ───────────────────── */

export function QrReviewSection({ venue }: { venue: Venue | null }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied]             = useState(false);
  const [guestReviews, setGuestReviews] = useState<VenueReview[]>([]);
  const [loadingGR, setLoadingGR]       = useState(true);
  const { moderating, handleModerate }  = useReviewModeration(setGuestReviews);

  useEffect(() => {
    if (!venue) { setLoadingGR(false); return; }
    fetch(`/api/venues/${venue.id}/reviews`)
      .then(r => r.ok ? r.json() : [])
      .then((data: VenueReview[]) => {
        setGuestReviews(data.filter(r =>
          (r.direction === "GUEST_TO_VENUE" || r.direction === "GUEST_TO_WAITER") &&
          r.status !== "REMOVED",
        ));
        setLoadingGR(false);
      })
      .catch(() => setLoadingGR(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.id]);

  if (!venue) {
    return (
      <div className="dash-card p-10 text-center text-neutral-400 text-sm">
        Prvo kreirajte profil lokala da biste generisali QR kod.
      </div>
    );
  }

  // Snapshot after null-guard: TS can't narrow `venue` inside nested function
  // closures (mutable prop reference), so we pin it to a const here.
  const v = venue;
  const reviewUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/review/${v.id}`
      : `/review/${v.id}`;

  async function copyLink() {
    await navigator.clipboard.writeText(reviewUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-recenzija-${v.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printQr() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR — ${v.name}</title><style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; gap: 16px; }
        img { width: 280px; height: 280px; }
        p { font-size: 14px; color: #555; text-align: center; max-width: 280px; }
        h2 { font-size: 20px; font-weight: 900; margin: 0; }
      </style></head><body>
        <h2>${v.name}</h2>
        <img src="${img}" />
        <p>Skenirajte QR kod i ostavite recenziju konobara koji vas je uslužio.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  return (
    <>
      <div className="dash-card p-4 sm:p-6 flex flex-col sm:flex-row gap-6">
        {/* QR code — centered on mobile, top-aligned on sm+ */}
        <div ref={wrapperRef} className="flex-shrink-0 flex flex-col items-center gap-3 self-center sm:self-start">
          <div className="p-3 sm:p-4 bg-white border border-neutral-200 rounded-2xl">
            <QRCodeCanvas value={reviewUrl} size={180} bgColor="#ffffff" fgColor="#1a1a1a" level="M" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadQr}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
            >
              Preuzmi PNG
            </button>
            <button
              onClick={printQr}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
            >
              Štampaj
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div>
            <h3 className="font-bold text-neutral-900 break-words">Gostinska recenzija za {v.name}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
              Postavite ovaj QR kod na sto, šank ili ulaz. Gosti skeniraju, biraju konobara i ostavljaju ocenu — bez registracije.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-500 mb-1.5">Link za recenziju</div>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-600 font-mono truncate flex items-center">
                {reviewUrl}
              </div>
              <button
                onClick={copyLink}
                className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-orange-500 text-white hover:bg-orange-600"}`}
              >
                {copied ? "✓" : "Kopiraj"}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex flex-col gap-1.5">
            <div className="text-xs font-black text-amber-700 uppercase tracking-wider">Kako funkcioniše</div>
            <ul className="text-xs text-amber-700 flex flex-col gap-1.5">
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">1.</span><span>Gost skenira QR i bira konobara</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">2.</span><span>Ocenjuje ljubaznost, brzinu i pažljivost (1–5 ★)</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">3.</span><span>GPS potvrđuje da je gost u lokalu</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">4.</span><span>Recenzija se objavljuje za 2h i utiče na skor konobara</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Guest reviews feed */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-neutral-900 text-sm">Gostinske recenzije</h3>
          {!loadingGR && <span className="text-xs text-neutral-400">{guestReviews.length} primljeno</span>}
        </div>

        {loadingGR ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : guestReviews.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">Još nema gostinskih recenzija.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {guestReviews.map(r => (
              <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-neutral-900 text-sm">
                      {r.direction === "GUEST_TO_WAITER"
                        ? (r.subject?.name ?? "Konobar")
                        : (r.guestHandle ?? "Gost")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.direction === "GUEST_TO_VENUE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {r.direction === "GUEST_TO_VENUE" ? "Lokal" : "Konobar"}
                    </span>
                    <ReviewStatusBadge status={r.status} />
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{formatDate(r.createdAt)}</span>
                </div>
                {r.direction === "GUEST_TO_WAITER" && r.guestHandle && (
                  <div className="text-xs text-neutral-400 mb-1">od: {r.guestHandle}</div>
                )}
                <div className="text-orange-400 text-sm tracking-wide mb-1">{starsText(r.overallRating)}</div>
                {r.comment && <p className="text-sm text-neutral-600 leading-relaxed">{r.comment}</p>}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {r.ratingAtmosphere    != null && <span className="text-xs text-neutral-400">Atmosfera {starsText(r.ratingAtmosphere)}</span>}
                  {r.ratingOrganization  != null && <span className="text-xs text-neutral-400">Organizacija {starsText(r.ratingOrganization)}</span>}
                  {r.ratingHygieneWork   != null && <span className="text-xs text-neutral-400">Higijena {starsText(r.ratingHygieneWork)}</span>}
                  {r.ratingFriendliness  != null && <span className="text-xs text-neutral-400">Ljubaznost {starsText(r.ratingFriendliness)}</span>}
                  {r.ratingGuestSpeed    != null && <span className="text-xs text-neutral-400">Brzina {starsText(r.ratingGuestSpeed)}</span>}
                  {r.ratingAttentiveness != null && <span className="text-xs text-neutral-400">Pažljivost {starsText(r.ratingAttentiveness)}</span>}
                </div>
                {r.status === "PENDING" && (
                  <ModerationButtons reviewId={r.id} moderating={moderating} onModerate={handleModerate} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Hub: Recenzije ──────────────────────────────────────────────────────── */

const REVIEW_TABS: { key: Section; label: string }[] = [
  { key: "reviews",    label: "Recenzije" },
  { key: "qr-review",  label: "QR Recenzije" },
];

export function ReviewsHub({ section, venue, onNavigate }: {
  section: Section;
  venue: Venue | null;
  onNavigate: (s: Section) => void;
}) {
  const activeTab = REVIEW_TABS.find(t => t.key === section)?.key ?? "reviews";

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/5 rounded-xl p-1 flex gap-1">
        {REVIEW_TABS.map(t => (
          <button key={t.key} onClick={() => onNavigate(t.key)}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === t.key
                ? "bg-orange-500 text-white shadow-sm"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === "reviews"   && <ReviewsSection venue={venue} />}
      {activeTab === "qr-review" && <QrReviewSection venue={venue} />}
    </div>
  );
}
