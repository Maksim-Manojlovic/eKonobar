"use client";

import { useState } from "react";
import type { Section, AppFilter, OwnPost, IncomingApp, Venue } from "./venue-types";
import { getInitials, formatSalary } from "@/lib/formatting/utils";
import { formatDate } from "@/lib/formatting/display-maps";
import { ENGAGEMENT_LABELS } from "@/lib/formatting/display-maps";
import { PostStatusBadge, AppStatusBadge, TierBadge, ScorePill, PostsSkeleton, ApplicationsSkeleton, EmptyVenue } from "./venue-helpers";
/* ── Section: Posts ──────────────────────────────────────────────────────── */

export function PostsSection({ posts, loading, onNavigate, onStatusChange }: {
  posts: OwnPost[]; loading: boolean;
  onNavigate: (s: Section) => void;
  onStatusChange: (id: string, status: "ACTIVE" | "PAUSED") => Promise<void>;
}) {
  const [changing, setChanging] = useState<string | null>(null);

  const handleToggle = async (id: string, current: string) => {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setChanging(id);
    await onStatusChange(id, next as "ACTIVE" | "PAUSED");
    setChanging(null);
  };

  if (loading) return <PostsSkeleton />;
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-black text-white">Moji oglasi</h2>
        <button onClick={() => onNavigate("new-post")} className="btn-dash-orange px-4 py-2">+ Novi oglas</button>
      </div>
      {posts.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema oglasa — klikni &quot;+ Novi oglas&quot; da počneš</div>
        : <div className="flex flex-col gap-3">
            {posts.map(p => (
              <div key={p.id} className="dash-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{p.title}</span>
                      {p.redAlert && <span className="text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">⚡ Red Alert</span>}
                      <PostStatusBadge status={p.status} />
                    </div>
                    <div className="text-sm text-neutral-500 mt-0.5">{ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType} · {formatSalary(p)}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Objavljen {formatDate(p.createdAt)} · <span className="font-semibold text-neutral-600">{p._count.applications} prijava</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(p.status === "ACTIVE" || p.status === "PAUSED") && (
                      <button
                        onClick={() => handleToggle(p.id, p.status)}
                        disabled={changing === p.id}
                        className={`px-3 py-1.5 text-xs disabled:opacity-50 ${p.status === "ACTIVE" ? "btn-dash-outline" : "btn-dash-orange"}`}
                      >
                        {changing === p.id ? "..." : p.status === "ACTIVE" ? "Pauziraj" : "Aktiviraj"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: New Post ───────────────────────────────────────────────────── */

export function NewPostSection({ venue, onSuccess, onBack }: {
  venue: Venue | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", engagementType: "FULL_TIME", tipSystem: "INDIVIDUAL",
    salaryMin: "", salaryMax: "", sanitaryRequired: false, redAlert: false,
    redAlertNote: "", startDate: "", endDate: "", applicationDeadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!venue) return <EmptyVenue onNavigate={onBack} />;

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: venue!.id,
        title: form.title,
        description: form.description,
        engagementType: form.engagementType,
        tipSystem: form.tipSystem,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        sanitaryRequired: form.sanitaryRequired,
        redAlert: form.redAlert,
        redAlertNote: form.redAlertNote || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        applicationDeadline: form.applicationDeadline || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška pri kreiranju oglasa.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="btn-dash-outline px-3 py-1.5 text-sm flex items-center gap-1">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Nazad
        </button>
        <h2 className="font-black text-white">Novi oglas</h2>
      </div>

      <div className="dash-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv pozicije *</label>
          <input type="text" required value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="npr. Konobar/ica za vikend" className="auth-input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Opis *</label>
          <textarea required value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Opišite poziciju, uslove rada, iskustvo..." rows={4}
            className="auth-input resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tip angažmana *</label>
            <select required value={form.engagementType}
              onChange={e => set("engagementType", e.target.value)} className="auth-input">
              <option value="FULL_TIME">Stalno</option>
              <option value="SEASONAL">Sezonski</option>
              <option value="WEEKEND">Vikend</option>
              <option value="CELEBRATION">Slavlje</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Bakšiš sistem *</label>
            <select required value={form.tipSystem}
              onChange={e => set("tipSystem", e.target.value)} className="auth-input">
              <option value="INDIVIDUAL">Individualni (konobar zadržava)</option>
              <option value="SHARED">Zajednički fond</option>
              <option value="VENUE_POLICY">Politika lokala</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Plata od (RSD)</label>
            <input type="number" min={0} value={form.salaryMin}
              onChange={e => set("salaryMin", e.target.value)}
              placeholder="npr. 60 000" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Plata do (RSD)</label>
            <input type="number" min={0} value={form.salaryMax}
              onChange={e => set("salaryMax", e.target.value)}
              placeholder="npr. 90 000" className="auth-input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Datum početka</label>
            <input type="date" value={form.startDate}
              onChange={e => set("startDate", e.target.value)} className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Datum završetka</label>
            <input type="date" value={form.endDate}
              onChange={e => set("endDate", e.target.value)} className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Rok prijave</label>
            <input type="date" value={form.applicationDeadline}
              onChange={e => set("applicationDeadline", e.target.value)} className="auth-input" />
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.sanitaryRequired}
              onChange={e => set("sanitaryRequired", e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500" />
            <span className="text-sm text-neutral-700">Sanitarna knjižica obavezna</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.redAlert}
              onChange={e => set("redAlert", e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500" />
            <span className="text-sm text-neutral-700">⚡ Red Alert — hitna potreba, oglas se ističe</span>
          </label>
        </div>
        {form.redAlert && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Napomena za Red Alert</label>
            <input type="text" value={form.redAlertNote}
              onChange={e => set("redAlertNote", e.target.value)}
              placeholder="npr. Potreban odmah za vikend" className="auth-input" />
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-dash-orange px-6 py-2.5 disabled:opacity-60">
          {saving ? "Objavljivanje..." : "Objavi oglas"}
        </button>
        <button type="button" onClick={onBack} className="btn-dash-outline px-6 py-2.5">Otkaži</button>
      </div>
    </form>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

export function ApplicationsSection({ applications, loading, onStatusChange }: {
  applications: IncomingApp[]; loading: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<AppFilter>("SVE");
  const [changing, setChanging] = useState<string | null>(null);
  if (loading) return <ApplicationsSkeleton />;

  const filtered = filter === "SVE" ? applications : applications.filter(a => a.status === filter);
  const pendingCount = applications.filter(a => a.status === "PENDING").length;
  const tabs: { key: AppFilter; label: string }[] = [
    { key: "SVE", label: "Sve" }, { key: "PENDING", label: "Na čekanju" },
    { key: "SHORTLISTED", label: "Shortlist" }, { key: "ACCEPTED", label: "Prihvaćene" },
    { key: "REJECTED", label: "Odbijene" },
  ];

  const handleChange = async (id: string, status: string) => {
    setChanging(id);
    await onStatusChange(id, status);
    setChanging(null);
  };

  return (
    <>
      <h2 className="font-black text-white">Prijave konobara</h2>
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}>
            {t.label}
            {t.key === "PENDING" && pendingCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full inline-flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema prijava</div>
        : <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <div key={a.id} className="dash-card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                    {getInitials(a.waiter.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{a.waiter.name ?? "Konobar"}</span>
                      <TierBadge tier={a.waiter.verificationTier} />
                      {a.waiter.waiterPassport && <ScorePill score={a.waiter.waiterPassport.score} />}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">Oglas: {a.jobPost.title} · {formatDate(a.appliedAt)}</div>
                    {a.waiter.waiterPassport?.badges && a.waiter.waiterPassport.badges.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {a.waiter.waiterPassport.badges.slice(0, 3).map(b => (
                          <span key={b} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{b}</span>
                        ))}
                      </div>
                    )}
                    {a.waiter.waiterPassport?.sanitaryBookValid && (
                      <span className="inline-block mt-1 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Sanitarna ✓</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <AppStatusBadge status={a.status} />
                    {(a.status === "PENDING" || a.status === "SHORTLISTED") && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleChange(a.id, "ACCEPTED")} disabled={changing === a.id}
                          className="btn-dash-orange px-3 py-1.5 text-[11px] disabled:opacity-50">
                          {changing === a.id ? "..." : "Prihvati"}
                        </button>
                        <button onClick={() => handleChange(a.id, "REJECTED")} disabled={changing === a.id}
                          className="btn-dash-outline px-3 py-1.5 text-[11px] disabled:opacity-50">
                          Odbij
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

