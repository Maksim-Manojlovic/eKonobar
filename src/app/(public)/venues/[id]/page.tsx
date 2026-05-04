"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TrustRadar from "@/components/trust-score/TrustRadar";
import JobCard from "@/components/job/JobCard";
import ReviewWizard from "@/components/review/ReviewWizard";

const VENUE_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restoran", CAFE: "Kafić", BAR: "Bar",
  CATERING: "Ketering", HOTEL: "Hotel", EVENT: "Event",
};

type VenueDetail = {
  id: string; name: string; description?: string | null;
  address: string; municipality: string; city: string;
  venueType: string; cuisineTypes: string[];
  capacity?: number | null; trustScore: number;
  priceRangeMin?: number | null; priceRangeMax?: number | null;
  phone?: string | null; website?: string | null; instagram?: string | null;
  venueTrustScore?: Record<string, number> | null;
  _count: { jobPosts: number; reviews: number };
  jobPosts: Array<{
    id: string; title: string; engagementType: string; tipSystem: string;
    salaryMin?: number | null; salaryMax?: number | null;
    sanitaryRequired: boolean; redAlert: boolean; redAlertNote?: string | null;
    startDate?: string | null; _count: { applications: number };
  }>;
  recentReviews: Array<{
    id: string; overallRating: number; comment?: string | null;
    publishedAt?: string | null;
    author: { name?: string | null; verificationTier: string };
  }>;
};

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const stars = Math.round(value / 20);
  return <span className="text-amber-400">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>;
}

export default function VenueDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [venue, setVenue]       = useState<VenueDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    fetch(`/api/venues/${params.id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        setVenue(await r.json());
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="min-h-screen hero-bg"><Spinner /></div>;
  if (notFound || !venue) return (
    <div className="min-h-screen hero-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">🍽️</p>
        <h2 className="font-black text-xl text-neutral-900 mb-2">Lokal nije pronađen</h2>
        <Link href="/venues" className="text-orange-500 font-bold hover:underline">← Svi lokali</Link>
      </div>
    </div>
  );

  const hasTrustDimensions = venue.venueTrustScore && venue.venueTrustScore.composite > 0;

  return (
    <div className="min-h-screen hero-bg">
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8">
        {/* Back */}
        <Link href="/venues" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors w-fit">
          ← Svi lokali
        </Link>

        {/* Header card */}
        <div className="dash-card p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                {VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}
              </p>
              <h1 className="text-3xl font-black text-neutral-900">{venue.name}</h1>
              <p className="text-neutral-500 mt-1">{venue.address}, {venue.municipality}</p>

              <div className="flex flex-wrap gap-3 mt-4">
                {venue.trustScore > 0 && (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-full">
                    ⭐ {venue.trustScore.toFixed(1)} reputacija
                  </div>
                )}
                {venue.capacity && (
                  <span className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-full">
                    {venue.capacity} mesta
                  </span>
                )}
                {venue._count.reviews > 0 && (
                  <span className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-full">
                    {venue._count.reviews} recenzija
                  </span>
                )}
              </div>

              {venue.cuisineTypes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {venue.cuisineTypes.map((c) => (
                    <span key={c} className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            {(venue.phone || venue.website || venue.instagram) && (
              <div className="flex flex-col gap-2 text-sm">
                {venue.phone    && <a href={`tel:${venue.phone}`}    className="text-neutral-600 hover:text-orange-500">📞 {venue.phone}</a>}
                {venue.website  && <a href={venue.website} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-orange-500">🌐 Website</a>}
                {venue.instagram && <a href={`https://instagram.com/${venue.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-orange-500">📸 Instagram</a>}
              </div>
            )}
          </div>

          {venue.description && (
            <p className="text-sm text-neutral-600 leading-relaxed mt-5 border-t border-neutral-100 pt-5">
              {venue.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trust radar */}
          {hasTrustDimensions && (
            <div className="dash-card p-6">
              <h2 className="font-black text-neutral-900 mb-4">Reputacija lokala</h2>
              <TrustRadar type="venue" scores={venue.venueTrustScore!} />
            </div>
          )}

          {/* Active jobs */}
          {venue.jobPosts.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-black text-neutral-900">Aktivni oglasi ({venue.jobPosts.length})</h2>
              {venue.jobPosts.map((j) => (
                <JobCard
                  key={j.id}
                  {...j}
                  venue={{ id: venue.id, name: venue.name, municipality: venue.municipality, venueType: venue.venueType }}
                  applicationCount={j._count.applications}
                />
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        {venue.recentReviews.length > 0 && (
          <div>
            <h2 className="font-black text-neutral-900 mb-4">Recenzije konobara ({venue._count.reviews})</h2>
            <div className="flex flex-col gap-3">
              {venue.recentReviews.map((r) => (
                <div key={r.id} className="dash-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{r.author.name ?? "Anonimno"}</p>
                      <Stars value={r.overallRating} />
                    </div>
                    <span className="text-xs text-neutral-400">
                      {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review CTA for waiters */}
        {session?.user.role === "WAITER" && (
          <div className="flex flex-col items-center gap-3">
            {showReview ? (
              <ReviewWizard
                direction="WAITER_TO_VENUE"
                venueId={venue.id}
                venueName={venue.name}
                onSuccess={() => setShowReview(false)}
                onCancel={() => setShowReview(false)}
              />
            ) : (
              <button
                onClick={() => setShowReview(true)}
                className="btn-dash-orange px-6 py-3 text-sm"
              >
                Oceni ovaj lokal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
