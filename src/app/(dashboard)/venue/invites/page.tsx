"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  VERIFICATION_TIER_COLORS,
  INVITE_STATUS_COLORS,
  INVITE_STATUS_LABELS,
  formatDate,
} from "@/lib/formatting/display-maps";
import type { SentInvite, VenueInviteWaiter } from "../venue-types";

import { useRequireRole } from "@/hooks/useRequireRole";
export default function VenueInvitesPage() {
  const { status } = useRequireRole("VENUE_OWNER");

  const [invites, setInvites]       = useState<SentInvite[]>([]);
  const [waiters, setWaiters]       = useState<VenueInviteWaiter[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ]       = useState("");
  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState<string | null>(null);
  const [sentIds, setSentIds]       = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/invites")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setInvites(d);
          setSentIds(new Set(d.map((i: SentInvite) => i.recipient.id)));
        }
        setLoading(false);
      });
  }, [status]);

  useEffect(() => {
    if (!showSearch) return;
    const params = new URLSearchParams();
    if (searchQ) params.set("search", searchQ);
    fetch(`/api/waiters?${params}`)
      .then(r => r.json())
      .then(d => setWaiters(d.waiters ?? []));
  }, [showSearch, searchQ]);

  async function sendInvite(waiterId: string) {
    setSending(waiterId);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId, message: message || null }),
    });
    if (res.ok) {
      setSentIds(prev => new Set([...prev, waiterId]));
      const newInvite = await res.json();
      setInvites(prev => [newInvite, ...prev]);
    }
    setSending(null);
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const filtered = waiters.filter(w =>
    !searchQ || w.name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/venue" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
            </div>
            <h1 className="text-2xl font-black text-neutral-900">Pozivnice za verifikaciju</h1>
            <p className="text-sm text-neutral-500">{invites.length} poslato</p>
          </div>
          <button onClick={() => setShowSearch(v => !v)} className="btn-dash-orange px-5 py-2.5 text-sm">
            {showSearch ? "Zatvori pretragu" : "+ Pozovi konobara"}
          </button>
        </div>

        {/* Search & send panel */}
        {showSearch && (
          <div className="dash-card p-5 flex flex-col gap-4">
            <h3 className="font-bold text-neutral-900">Pozovi konobara</h3>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Pretraži konobara po imenu..." className="auth-input" />
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Poruka (opciono)</label>
              <input value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Zdravo, imamo slobodnih mesta..." className="auth-input" />
            </div>

            {filtered.length > 0 && (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {filtered.slice(0, 20).map(w => (
                  <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-black text-xs flex items-center justify-center flex-shrink-0">
                        {w.name ? w.name.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase() : "?"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">{w.name ?? "Konobar"}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${VERIFICATION_TIER_COLORS[w.verificationTier] ?? VERIFICATION_TIER_COLORS.UNVERIFIED}`}>
                            {w.verificationTier.replace("_", " ")}
                          </span>
                          {w.waiterPassport && (
                            <span className="text-[10px] font-bold text-orange-500">{Math.round(w.waiterPassport.score)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => sendInvite(w.id)}
                      disabled={sending === w.id || sentIds.has(w.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 ${sentIds.has(w.id) ? "bg-green-50 text-green-700 border border-green-200" : "btn-dash-orange"}`}
                    >
                      {sentIds.has(w.id) ? "✓ Poslato" : sending === w.id ? "..." : "Pozovi"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sent invites list */}
        {invites.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">📩</p>
            <p className="font-bold text-neutral-900">Nema poslatih pozivnica.</p>
          </div>
        ) : (
          <div className="dash-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  {["Konobar", "Datum", "Ističe", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-black text-xs flex items-center justify-center flex-shrink-0">
                          {inv.recipient.name ? inv.recipient.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{inv.recipient.name ?? "Konobar"}</p>
                          {inv.message && <p className="text-xs text-neutral-400 truncate max-w-[180px]">{inv.message}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(inv.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${INVITE_STATUS_COLORS[inv.status] ?? ""}`}>
                        {INVITE_STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
