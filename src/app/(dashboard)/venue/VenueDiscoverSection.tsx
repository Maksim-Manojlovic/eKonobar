"use client";

import { useState, useEffect } from "react";
import type { OwnPost, IncomingApp, WaiterEntry, Venue } from "./venue-types";
import { getInitials } from "@/lib/formatting/utils";
import { TierBadge, PassportTierBadge, ScorePill, DiscoverSkeleton, WaitersSkeleton } from "./venue-helpers";
/* ── InviteModal ─────────────────────────────────────────────────────────── */

export function InviteModal({ waiter, posts, onClose, onSent }: {
  waiter: WaiterEntry; posts: OwnPost[]; onClose: () => void; onSent: () => void;
}) {
  const [jobPostId, setJobPostId] = useState(posts.find(p => p.status === "ACTIVE")?.id ?? "");
  const [message, setMessage]     = useState("");
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);

  const activePosts = posts.filter(p => p.status === "ACTIVE");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!jobPostId) { setError("Odaberi oglas"); return; }
    setSending(true); setError("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: waiter.id, jobPostId, message: message || undefined }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "Invite already sent" ? "Pozivnica je već poslata ovom konobaru za ovaj oglas." : (data.error ?? "Greška"));
      return;
    }
    setDone(true);
    setTimeout(onSent, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#15803d" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="font-bold text-neutral-900">Pozivnica poslata!</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                {getInitials(waiter.name)}
              </div>
              <div>
                <div className="font-bold text-neutral-900">{waiter.name ?? "Konobar"}</div>
                <div className="text-xs text-neutral-400">Slanje pozivnice</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Oglas</label>
              {activePosts.length === 0
                ? <p className="text-xs text-neutral-400">Nemaš aktivnih oglasa.</p>
                : <select value={jobPostId} onChange={e => setJobPostId(e.target.value)} className="auth-input">
                    {activePosts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
              }
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Poruka (opciono)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Videli smo tvoj profil i mislimo da bi bio odličan fit za naš tim..."
                className="auth-input resize-none" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-dash-outline flex-1 py-2.5">Otkaži</button>
              <button type="submit" disabled={sending || activePosts.length === 0}
                className="btn-dash-orange flex-1 py-2.5 disabled:opacity-50">
                {sending ? "Slanje..." : "Pošalji pozivnicu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Section: Discover ───────────────────────────────────────────────────── */

export function DiscoverSection({ onInvite }: { posts: OwnPost[]; onInvite: (w: WaiterEntry) => void }) {
  const [waiters, setWaiters]           = useState<WaiterEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [filterMinScore, setFilterMinScore]   = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterAvailable) params.set("available", "true");
    if (filterMinScore > 0) params.set("minScore", String(filterMinScore));
    setLoading(true);
    fetch(`/api/waiters?${params}`)
      .then(r => r.json())
      .then(data => { setWaiters(data.waiters ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterAvailable, filterMinScore]);

  return (
    <>
      <h2 className="font-black text-white">Pronađi konobara</h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterAvailable(p => !p)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterAvailable ? "bg-green-500 text-white border-green-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-green-400"}`}>
          Samo dostupni
        </button>
        {[0, 50, 70, 85].map(score => (
          <button key={score} onClick={() => setFilterMinScore(score)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterMinScore === score ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"}`}>
            {score === 0 ? "Svi" : `Score ${score}+`}
          </button>
        ))}
      </div>
      {loading ? <DiscoverSkeleton /> : waiters.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema konobara koji odgovaraju filteru</div>
        : <div className="grid gap-3 sm:grid-cols-2">
            {waiters.map(w => (
              <div key={w.id} className="dash-card p-5">
                <div className="flex items-start gap-3">
                  {w.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={w.image} alt={w.name ?? ""} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">{getInitials(w.name)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{w.name ?? "Konobar"}</span>
                      <TierBadge tier={w.verificationTier} />
                      <PassportTierBadge tier={w.waiterPassport?.passportTier} expiresAt={w.waiterPassport?.subscriptionExpiresAt} />
                    </div>
                    {w.waiterPassport && (
                      <>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <ScorePill score={w.waiterPassport.score} />
                          {w.waiterPassport.currentlyAvailable
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Dostupan</span>
                            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">Zauzet</span>
                          }
                          {w.waiterPassport.sanitaryBookValid && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Sanitarna ✓</span>
                          )}
                        </div>
                        {w.waiterPassport.skills.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {w.waiterPassport.skills.slice(0, 4).map(s => (
                              <span key={s} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{s}</span>
                            ))}
                          </div>
                        )}
                        {w.waiterPassport.yearsExperience > 0 && (
                          <div className="text-xs text-neutral-400 mt-1">{w.waiterPassport.yearsExperience}g iskustva</div>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => onInvite(w)} className="btn-dash-orange px-3 py-1.5 text-[11px] flex-shrink-0 mt-1">
                    Pozovi
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Waiters ────────────────────────────────────────────────────── */

export function WaitersSection({ applications, loading, onInvite, venue }: { applications: IncomingApp[]; loading: boolean; onInvite: (w: WaiterEntry) => void; venue: Venue | null }) {
  if (loading) return <WaitersSkeleton />;
  const unique = Object.values(
    applications.reduce<Record<string, IncomingApp>>((acc, a) => {
      if (!acc[a.waiter.id]) acc[a.waiter.id] = a;
      return acc;
    }, {})
  );
  return (
    <>
      <h2 className="font-black text-white">Konobari koji su se prijavili</h2>
      {unique.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Još nema prijava</div>
        : <div className="grid gap-3 sm:grid-cols-2">
            {unique.map(a => (
              <div key={a.waiter.id} className="dash-card p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                    {getInitials(a.waiter.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{a.waiter.name ?? "Konobar"}</span>
                      <TierBadge tier={a.waiter.verificationTier} />
                      {venue?.headWaiterId === a.waiter.id && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          Šef konobara
                        </span>
                      )}
                    </div>
                    {a.waiter.waiterPassport && (
                      <div className="flex items-center gap-2 mt-1">
                        <ScorePill score={a.waiter.waiterPassport.score} />
                        {a.waiter.waiterPassport.currentlyAvailable
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Dostupan</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">Zauzet</span>
                        }
                      </div>
                    )}
                  </div>
                  <button onClick={() => onInvite({
                    id: a.waiter.id, name: a.waiter.name, verificationTier: a.waiter.verificationTier,
                    waiterPassport: a.waiter.waiterPassport ? {
                      score: a.waiter.waiterPassport.score, skills: [], languages: [],
                      yearsExperience: 0, sanitaryBookValid: a.waiter.waiterPassport.sanitaryBookValid,
                      currentlyAvailable: a.waiter.waiterPassport.currentlyAvailable,
                      badges: a.waiter.waiterPassport.badges, bio: null,
                    } : null,
                  })} className="btn-dash-orange px-3 py-1.5 text-[11px] flex-shrink-0">Pozovi</button>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

