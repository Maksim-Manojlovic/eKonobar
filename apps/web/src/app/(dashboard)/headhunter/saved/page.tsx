"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Initials, VerifiedBadge, VerificationProofChip } from "@/components/ui/PassportWidgets";
import type { SavedEntry } from "../headhunter-types";

import { useRequireRole } from "@/hooks/useRequireRole";
export default function SavedProfilesPage() {
  const { status } = useRequireRole("HEADHUNTER");

  const [saved, setSaved]     = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/headhunter/saved")
      .then((r) => r.json())
      .then((d) => setSaved(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  async function remove(waiterId: string) {
    setRemoving(waiterId);
    try {
      await fetch("/api/headhunter/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiterId }),
      });
      setSaved((prev) => prev.filter((e) => e.waiter.id !== waiterId));
    } finally {
      setRemoving(null);
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/headhunter" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">
              ← Dashboard
            </Link>
            <h1 className="font-black text-2xl text-neutral-900">Sačuvani profili</h1>
          </div>
          <Link href="/headhunter/search" className="btn-dash-orange px-4 py-2 text-sm">
            + Dodaj
          </Link>
        </div>

        {saved.length === 0 ? (
          <div className="dash-card p-14 text-center flex flex-col gap-3 items-center">
            <p className="text-4xl">🔖</p>
            <p className="font-bold text-neutral-900">Nema sačuvanih profila</p>
            <Link href="/headhunter/search" className="btn-dash-orange px-6 py-2.5 text-sm mt-2">
              Pretraži konobara
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {saved.map(({ waiter: w, savedAt, notes }) => {
              const p = w.waiterPassport;
              return (
                <div key={w.id} className="dash-card p-5 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {w.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={w.image} alt={w.name ?? ""} className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 flex-shrink-0" />
                      : <Initials name={w.name} />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-black text-neutral-900 text-sm truncate">{w.name ?? "Konobar"}</p>
                        <VerifiedBadge tier={w.verificationTier} />
                      </div>
                      <div className="mt-1">
                        <VerificationProofChip tier={w.verificationTier} />
                      </div>
                    </div>
                    {p && (
                      <span className="text-xs font-black text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        {Math.round(p.score)}
                      </span>
                    )}
                  </div>

                  {p && (
                    <>
                      <div className="flex gap-3 text-center">
                        {[
                          { label: "Angažmana", v: p.totalEngagements },
                          { label: "Recenzija",  v: p.reviewCount },
                          { label: "God. isku.", v: p.yearsExperience },
                        ].map(({ label, v }) => (
                          <div key={label} className="flex-1">
                            <p className="text-sm font-black text-neutral-900">{v}</p>
                            <p className="text-[10px] text-neutral-400">{label}</p>
                          </div>
                        ))}
                      </div>

                      {p.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.skills.slice(0, 4).map((s) => (
                            <span key={s} className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-1.5 flex-wrap">
                        {p.currentlyAvailable && (
                          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Dostupan</span>
                        )}
                        {p.sanitaryBookValid && (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📋 Sanitarna</span>
                        )}
                      </div>
                    </>
                  )}

                  {notes && (
                    <p className="text-xs text-neutral-500 italic border-t border-neutral-100 pt-2">{notes}</p>
                  )}

                  <p className="text-[10px] text-neutral-300">
                    Sačuvan {new Date(savedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  <div className="flex gap-2 mt-auto">
                    {p?.shareToken && (
                      <Link href={`/passport/${p.shareToken}`} className="btn-dash-outline flex-1 py-1.5 text-xs text-center">
                        Pasoš
                      </Link>
                    )}
                    <button
                      onClick={() => remove(w.id)}
                      disabled={removing === w.id}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {removing === w.id ? "..." : "Ukloni"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
