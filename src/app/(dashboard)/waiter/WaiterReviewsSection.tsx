"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { WaiterReview } from "./waiter-types";
import { DIRECTION_LABELS } from "./waiter-types";
import { Sk, Stars } from "./waiter-helpers";

/* ── Section: Reviews ────────────────────────────────────────────────────── */

export function ReviewsSection() {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<WaiterReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/reviews?subjectId=${session.user.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(setReviews)
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <Sk className="h-7 w-44" />
      {[0, 1, 2].map(i => <Sk key={i} className="h-24 w-full" />)}
    </div>
  );

  return (
    <>
      <h2 className="font-black text-white">Moje recenzije</h2>
      {reviews.length === 0 ? (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">Još nema recenzija</div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map(r => {
            const stars = Math.round(r.overallRating / 20);
            const date = r.publishedAt
              ? new Date(r.publishedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" })
              : "";
            return (
              <div key={r.id} className="dash-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-neutral-900">{r.author.name ?? "Anonimno"}</div>
                      <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                        {DIRECTION_LABELS[r.direction] ?? r.direction}
                      </span>
                    </div>
                    <Stars n={stars} />
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{date}</span>
                </div>
                {r.comment && (
                  <p className="text-sm text-neutral-600 mt-3 leading-relaxed">{r.comment}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
