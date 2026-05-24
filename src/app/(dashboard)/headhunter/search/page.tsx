"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VERIFICATION_TIER_COLORS } from "@/lib/display-maps";
import { Initials, PassportTierBadge, ScorePill } from "@/components/ui/PassportWidgets";

const VERIFICATION_TIERS = [
  { value: "",            label: "Svi nivoi"    },
  { value: "ID_VERIFIED", label: "ID Verifikovan" },
  { value: "GOLD",        label: "Gold"         },
  { value: "SILVER",      label: "Silver"       },
  { value: "UNVERIFIED",  label: "Neverifikovan" },
];

type Waiter = {
  id: string;
  name?: string | null;
  image?: string | null;
  verificationTier: string;
  waiterPassport?: {
    score: number; skills: string[]; languages: string[];
    yearsExperience: number; sanitaryBookValid: boolean;
    currentlyAvailable: boolean; reviewCount: number;
    totalEngagements: number; shareToken?: string | null;
    passportTier?: string; subscriptionExpiresAt?: string | null;
  } | null;
};

export default function HeadhunterSearch() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [waiters, setWaiters]   = useState<Waiter[]>([]);
  const [loading, setLoading]   = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState<string | null>(null);

  // Filters
  const [search, setSearch]         = useState("");
  const [minScore, setMinScore]     = useState("");
  const [tier, setTier]             = useState("");
  const [available, setAvailable]   = useState(false);
  const [sanitaryOk, setSanitaryOk] = useState(false);
  const [minExp, setMinExp]         = useState("");
  const [skills, setSkills]         = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "HEADHUNTER") router.push("/");
  }, [status, session, router]);

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

  const runSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (search)     params.set("search", search);
    if (minScore)   params.set("minScore", minScore);
    if (tier)       params.set("verificationTier", tier);
    if (available)  params.set("available", "true");
    if (sanitaryOk) params.set("sanitaryBook", "true");
    if (minExp)     params.set("minExperience", minExp);
    if (skills)     params.set("skills", skills);

    setLoading(true);
    fetch(`/api/waiters?${params}`)
      .then((r) => r.json())
      .then((d) => setWaiters(d.waiters ?? []))
      .finally(() => setLoading(false));
  }, [search, minScore, tier, available, sanitaryOk, minExp, skills]);

  // Initial load only — button handles subsequent searches
  useEffect(() => {
    if (status === "authenticated") runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ime konobara..." className="auth-input" />
            <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Veštine (npr. cocktail,sommelier)" className="auth-input" />
            <input value={minScore} onChange={e => setMinScore(e.target.value)} placeholder="Min. skor (0-100)" type="number" min="0" max="100" className="auth-input" />
            <input value={minExp} onChange={e => setMinExp(e.target.value)} placeholder="Min. godina iskustva" type="number" min="0" className="auth-input" />

            <select value={tier} onChange={e => setTier(e.target.value)} className="auth-input bg-white">
              {VERIFICATION_TIERS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setAvailable(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  available ? "bg-green-500 text-white border-green-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-green-300"
                }`}
              >
                ✓ Dostupan
              </button>
              <button
                onClick={() => setSanitaryOk(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  sanitaryOk ? "bg-blue-500 text-white border-blue-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
                }`}
              >
                📋 Sanitarna
              </button>
            </div>
          </div>

          <button onClick={runSearch} className="btn-dash-orange py-2.5 text-sm w-full sm:w-auto sm:px-8 self-end">
            Pretraži
          </button>
        </div>

        {/* Results */}
        {loading ? (
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
              const p = w.waiterPassport;
              const isSaved = savedIds.has(w.id);
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
                        <PassportTierBadge tier={p?.passportTier} expiresAt={p?.subscriptionExpiresAt} />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_TIER_COLORS[w.verificationTier] ?? VERIFICATION_TIER_COLORS.UNVERIFIED}`}>
                        {w.verificationTier.replace("_", " ")}
                      </span>
                    </div>
                    {p && <ScorePill score={p.score} />}
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
                          {p.skills.slice(0, 3).map((s) => (
                            <span key={s} className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                          {p.skills.length > 3 && (
                            <span className="text-xs text-neutral-400">+{p.skills.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-1.5 flex-wrap">
                        {p.currentlyAvailable && (
                          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            Dostupan
                          </span>
                        )}
                        {p.sanitaryBookValid && (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            📋 Sanitarna
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 mt-auto pt-1">
                    {p?.shareToken && (
                      <Link
                        href={`/passport/${p.shareToken}`}
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
