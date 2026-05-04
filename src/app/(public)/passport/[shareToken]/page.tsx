"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import PassportCard from "@/components/passport/PassportCard";
import TrustRadar from "@/components/trust-score/TrustRadar";
import EngagementTimeline, { type EngagementRecord } from "@/components/passport/EngagementTimeline";
import ReviewWizard from "@/components/review/ReviewWizard";

type PublicPassport = {
  passport: {
    userId: string;
    score: number; badges: string[];
    reviewCount: number; totalEngagements: number; avgEngagementMonths: number;
    skills: string[]; languages: string[];
    yearsExperience: number; sanitaryBookValid: boolean; currentlyAvailable: boolean;
    bio?: string | null;
    trustScore?: Record<string, number> | null;
    user: { id: string; name?: string | null; image?: string | null; verificationTier: string };
  };
  engagements: EngagementRecord[];
  reviews: Array<{
    id: string; direction: string; overallRating: number;
    comment?: string | null; publishedAt?: string | null;
    author: { name?: string | null; verificationTier: string };
    venue?: { id: string; name: string } | null;
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

export default function PublicPassportPage({ params }: { params: { shareToken: string } }) {
  const { data: session } = useSession();
  const [data, setData]         = useState<PublicPassport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    fetch(`/api/passport/public/${params.shareToken}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) { setError(json.error ?? "Greška"); return; }
        setData(json);
      })
      .finally(() => setLoading(false));
  }, [params.shareToken]);

  if (loading) return <div className="min-h-screen hero-bg"><Spinner /></div>;

  if (error || !data) return (
    <div className="min-h-screen hero-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">🪪</p>
        <h2 className="font-black text-xl text-neutral-900 mb-2">
          {error === "Link je istekao" ? "Link je istekao" : "Profil nije pronađen"}
        </h2>
        <p className="text-sm text-neutral-400">{error}</p>
      </div>
    </div>
  );

  const { passport, engagements, reviews } = data;
  const hasTrustDimensions = passport.trustScore && passport.trustScore.composite > 0;
  const canReview = !!session && session.user.id !== passport.userId;

  return (
    <div className="min-h-screen hero-bg">
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8">

        {/* Passport card */}
        <PassportCard
          name={passport.user.name}
          image={passport.user.image}
          score={passport.score}
          verificationTier={passport.user.verificationTier}
          yearsExperience={passport.yearsExperience}
          totalEngagements={passport.totalEngagements}
          reviewCount={passport.reviewCount}
          sanitaryBookValid={passport.sanitaryBookValid}
          currentlyAvailable={passport.currentlyAvailable}
          skills={passport.skills}
          languages={passport.languages}
          bio={passport.bio}
          badges={passport.badges}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trust radar */}
          {hasTrustDimensions && (
            <div className="dash-card p-6">
              <h2 className="font-black text-neutral-900 mb-4">Profesionalni profil</h2>
              <TrustRadar type="waiter" scores={passport.trustScore!} />
            </div>
          )}

          {/* Engagements */}
          {engagements.length > 0 && (
            <div className="dash-card p-6">
              <h2 className="font-black text-neutral-900 mb-4">
                Iskustvo ({engagements.length})
              </h2>
              <EngagementTimeline records={engagements} compact />
            </div>
          )}
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div>
            <h2 className="font-black text-neutral-900 mb-4">
              Recenzije ({passport.reviewCount})
            </h2>
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="dash-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{r.author.name ?? "Anonimno"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Stars value={r.overallRating} />
                        {r.venue && (
                          <span className="text-xs text-neutral-400">· {r.venue.name}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400 flex-shrink-0">
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

        {/* Guest review CTA */}
        {canReview && !reviewDone && (
          <div className="flex flex-col items-center gap-3">
            {showReview ? (
              <ReviewWizard
                direction="GUEST_TO_WAITER"
                subjectId={passport.userId}
                subjectName={passport.user.name ?? undefined}
                onSuccess={() => { setReviewDone(true); setShowReview(false); }}
                onCancel={() => setShowReview(false)}
              />
            ) : (
              <button
                onClick={() => setShowReview(true)}
                className="btn-dash-orange px-6 py-3 text-sm"
              >
                Ostavi recenziju
              </button>
            )}
          </div>
        )}
        {reviewDone && (
          <p className="text-center text-sm text-green-600 font-bold">
            ✓ Recenzija je poslata. Biće objavljena u roku od 2 sata.
          </p>
        )}
      </div>
    </div>
  );
}
