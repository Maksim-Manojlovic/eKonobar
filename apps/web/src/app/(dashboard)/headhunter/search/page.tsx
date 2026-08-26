"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WaiterCard } from "@/components/ui/WaiterCard";
import { useWaiterSearch, type WaiterFilters } from "@/hooks/useWaiterSearch";
import { useRequireRole } from "@/hooks/useRequireRole";
import type { Waiter } from "../headhunter-types";

const VERIFICATION_TIERS = [
  { value: "",            label: "Svi nivoi"    },
  { value: "ID_VERIFIED", label: "ID Verifikovan" },
  { value: "GOLD",        label: "Gold"         },
  { value: "SILVER",      label: "Silver"       },
  { value: "UNVERIFIED",  label: "Neverifikovan" },
];

const EMPTY_FILTERS: WaiterFilters = {};

export default function HeadhunterSearch() {
  const { status } = useRequireRole("HEADHUNTER");

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState<string | null>(null);

  // Draft filters (form inputs) vs applied filters (drive the fetch). The search only runs
  // when `applied` changes — i.e. on the Pretraži button — preserving the button-triggered UX.
  const [draft, setDraft]     = useState<WaiterFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<WaiterFilters>(EMPTY_FILTERS);

  const { waiters, isLoading } = useWaiterSearch<Waiter>(applied, {
    enabled: status === "authenticated",
  });

  const setField = <K extends keyof WaiterFilters>(k: K, v: WaiterFilters[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Load saved ids
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/headhunter/saved")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setSavedIds(new Set(d.map((e: { waiter: { id: string } }) => e.waiter?.id).filter(Boolean)));
        }
      });
  }, [status]);

  async function toggleSave(waiterId: string) {
    setSaving(waiterId);
    const isSaved = savedIds.has(waiterId);
    try {
      await fetch("/api/headhunter/saved", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiterId }),
      });
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) { next.delete(waiterId); } else { next.add(waiterId); }
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/headhunter" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">
            ← Dashboard
          </Link>
          <h1 className="font-black text-2xl text-neutral-900">Pretraži konobara</h1>
        </div>

        {/* Filters */}
        <div className="dash-card p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input value={draft.search ?? ""} onChange={e => setField("search", e.target.value)} placeholder="Ime konobara..." className="auth-input" />
            <input value={draft.skills ?? ""} onChange={e => setField("skills", e.target.value)} placeholder="Veštine (npr. cocktail,sommelier)" className="auth-input" />
            <input value={draft.minScore ?? ""} onChange={e => setField("minScore", e.target.value)} placeholder="Min. skor (0-100)" type="number" min="0" max="100" className="auth-input" />
            <input value={draft.minExperience ?? ""} onChange={e => setField("minExperience", e.target.value)} placeholder="Min. godina iskustva" type="number" min="0" className="auth-input" />

            <select value={draft.verificationTier ?? ""} onChange={e => setField("verificationTier", e.target.value)} className="auth-input bg-white">
              {VERIFICATION_TIERS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setField("available", !draft.available)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  draft.available ? "bg-green-500 text-white border-green-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-green-300"
                }`}
              >
                ✓ Dostupan
              </button>
              <button
                onClick={() => setField("sanitaryBook", !draft.sanitaryBook)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  draft.sanitaryBook ? "bg-blue-500 text-white border-blue-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
                }`}
              >
                📋 Sanitarna
              </button>
            </div>
          </div>

          <button onClick={() => setApplied({ ...draft })} className="btn-dash-orange py-2.5 text-sm w-full sm:w-auto sm:px-8 self-end">
            Pretraži
          </button>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : waiters.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-neutral-500 font-medium">Nema rezultata. Promeni filtere.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiters.map((w) => {
              const isSaved = savedIds.has(w.id);
              return (
                <WaiterCard
                  key={w.id}
                  waiter={w}
                  showStats
                  maxSkills={3}
                  actions={
                    <>
                      {w.waiterPassport?.shareToken && (
                        <Link
                          href={`/passport/${w.waiterPassport.shareToken}`}
                          className="btn-dash-outline flex-1 py-1.5 text-xs text-center"
                        >
                          Pasoš
                        </Link>
                      )}
                      <button
                        onClick={() => toggleSave(w.id)}
                        disabled={saving === w.id}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all disabled:opacity-50 ${
                          isSaved
                            ? "bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100"
                            : "btn-dash-orange"
                        }`}
                      >
                        {saving === w.id ? "..." : isSaved ? "🔖 Sačuvan" : "Sačuvaj"}
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
