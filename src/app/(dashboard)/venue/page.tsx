"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import ImageUpload from "@/components/ui/ImageUpload";

type Section = "overview" | "posts" | "new-post" | "smene" | "applications" | "waiters" | "discover" | "reviews" | "profile";
type AppFilter = "SVE" | "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";

type VenueShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  pay: number | null;
  notes: string | null;
  waiters: { id: string; name: string | null }[];
};

const DAYS_SR   = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const MONTHS_SR = ["Januar", "Februar", "Mart", "April", "Maj", "Jun",
                   "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

/* ── API types ────────────────────────────────────────────────────────────── */

type Venue = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  city: string;
  venueType: string;
  capacity: number | null;
  trustScore: number;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  images: string[];
  _count: { jobPosts: number };
  venueTrustScore: {
    atmosphere: number; organization: number; pay: number;
    tips: number; hygieneStandards: number; management: number;
    composite: number; sampleSize: number;
  } | null;
};

type OwnPost = {
  id: string;
  title: string;
  engagementType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  redAlert: boolean;
  status: string;
  createdAt: string;
  venue: { id: string; name: string };
  _count: { applications: number };
};

type WaiterEntry = {
  id: string;
  name: string | null;
  verificationTier: string;
  waiterPassport: {
    score: number;
    skills: string[];
    languages: string[];
    yearsExperience: number;
    sanitaryBookValid: boolean;
    currentlyAvailable: boolean;
    badges: string[];
    bio: string | null;
  } | null;
};

type IncomingApp = {
  id: string;
  status: string;
  appliedAt: string;
  jobPost: { id: string; title: string; venueId: string };
  waiter: {
    id: string;
    name: string | null;
    verificationTier: string;
    waiterPassport: {
      score: number;
      badges: string[];
      sanitaryBookValid: boolean;
      currentlyAvailable: boolean;
    } | null;
  };
};

/* ── Static placeholder data (no API yet) ────────────────────────────────── */

const REVIEWS = [
  { id: 1, waiter: "Jovana Milić",    rating: 5, date: "15 Apr 2026", text: "Izuzetna profesionalka. Smirena u najluđim noćima, gosti je obožavaju." },
  { id: 2, waiter: "Marko Nikolić",   rating: 5, date: "2 Apr 2026",  text: "Tačan, brz, komunikativan. Bez ikakvih primedbi — preporučujem svim lokalima." },
  { id: 3, waiter: "Stefan Đorđević", rating: 3, date: "18 Mar 2026", text: "Solidan rad, ali kasnio 15 minuta na početak smene." },
];

/* ── Utility ──────────────────────────────────────────────────────────────── */

const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Stalno", SEASONAL: "Sezonski", WEEKEND: "Vikend", CELEBRATION: "Slavlje",
};

const VENUE_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restoran", CAFE: "Kafić", BAR: "Bar",
  CATERING: "Ketering", HOTEL: "Hotel", EVENT: "Event",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatSalary({ salaryMin, salaryMax, engagementType }: Pick<OwnPost, "salaryMin" | "salaryMax" | "engagementType">): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax) return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

function trustDimensions(ts: Venue["venueTrustScore"]): { label: string; value: number }[] {
  if (!ts) return [
    { label: "Atmosfera", value: 0 }, { label: "Organizacija", value: 0 },
    { label: "Isplata", value: 0 },   { label: "Bakšiš sistem", value: 0 },
    { label: "Higijena", value: 0 },  { label: "Menadžment", value: 0 },
  ];
  return [
    { label: "Atmosfera",    value: Math.round(ts.atmosphere) },
    { label: "Organizacija", value: Math.round(ts.organization) },
    { label: "Isplata",      value: Math.round(ts.pay) },
    { label: "Bakšiš sistem",value: Math.round(ts.tips) },
    { label: "Higijena",     value: Math.round(ts.hygieneStandards) },
    { label: "Menadžment",   value: Math.round(ts.management) },
  ];
}

/* ── Helper components ────────────────────────────────────────────────────── */

function PostStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE")  return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Aktivan</span>;
  if (status === "PAUSED")  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Pauziran</span>;
  if (status === "FILLED")  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Popunjen</span>;
  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
}

function AppStatusBadge({ status }: { status: string }) {
  if (status === "ACCEPTED")    return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Prihvaćen</span>;
  if (status === "REJECTED")    return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Odbijen</span>;
  if (status === "SHORTLISTED") return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>Shortlist</span>;
  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Na čekanju</span>;
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "GOLD")   return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🥇 GOLD</span>;
  if (tier === "SILVER") return <span className="bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">🥈 SILVER</span>;
  return null;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-400 text-sm">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 85 ? "#f97316" : score >= 70 ? "#eab308" : "#6b7280";
  return <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{Math.round(score)}</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyVenue({ onNavigate }: { onNavigate: (s: Section) => void }) {
  return (
    <div className="dash-card p-10 flex flex-col items-center gap-4 text-center">
      <div className="text-4xl">🏠</div>
      <div>
        <h3 className="font-bold text-neutral-900">Nemaš registrovan lokal</h3>
        <p className="text-sm text-neutral-400 mt-1">Dodaj lokal kako bi mogao da objaviš oglas.</p>
      </div>
      <button onClick={() => onNavigate("profile")} className="btn-dash-orange px-5 py-2">Dodaj lokal</button>
    </div>
  );
}

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ venue, posts, applications, loading, onNavigate }: {
  venue: Venue | null; posts: OwnPost[]; applications: IncomingApp[];
  loading: boolean; onNavigate: (s: Section) => void;
}) {
  if (loading) return <Spinner />;
  if (!venue) return <EmptyVenue onNavigate={onNavigate} />;

  const score = Math.round(venue.trustScore) || 86;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const pendingCount = applications.filter(a => a.status === "PENDING").length;
  const activePosts  = posts.filter(p => p.status === "ACTIVE");
  const dims = trustDimensions(venue.venueTrustScore);

  return (
    <>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f0efec" strokeWidth="8" />
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f97316" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-neutral-900">{score}</span>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">trust</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex gap-2 flex-wrap mb-1">
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />Aktivan
            </span>
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}
            </span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900">{venue.name}</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{venue.address} · {venue.municipality}</p>
          <div className="flex gap-6 mt-4">
            {[
              { label: "Aktivni oglasi", value: String(activePosts.length) },
              { label: "Prijave",        value: String(applications.length) },
              { label: "Ocena",          value: score > 0 ? String(score) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => onNavigate("new-post")} className="btn-dash-orange px-4 py-2 self-start whitespace-nowrap">
          + Novi oglas
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="alert-card p-4 flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("applications")}>
          <div className="relative w-4 h-4 flex-shrink-0">
            <span className="pulse-ring w-4 h-4" /><span className="pulse-ring-2 w-4 h-4" />
            <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>
          <div className="flex-1">
            <span className="font-bold text-neutral-900 text-sm">{pendingCount} prijav{pendingCount === 1 ? "a čeka" : "e čekaju"} na odgovor</span>
            <p className="text-xs text-neutral-500">Kliknite da pregledite i odlučite</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Aktivni oglasi</h3>
            <button onClick={() => onNavigate("posts")} className="text-xs text-orange-500 font-semibold hover:underline">Svi</button>
          </div>
          {activePosts.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Nema aktivnih oglasa</p>
            : <div className="flex flex-col gap-2">
                {activePosts.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                        {p.title}
                        {p.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">⚡ RED</span>}
                      </div>
                      <div className="text-xs text-neutral-400">{ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType} · {p._count.applications} prijava</div>
                    </div>
                    <PostStatusBadge status={p.status} />
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Nedavne prijave</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          {applications.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Nema prijava</p>
            : <div className="flex flex-col gap-2">
                {applications.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-[11px] flex-shrink-0">
                        {getInitials(a.waiter.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-800">{a.waiter.name ?? "Konobar"}</div>
                        <div className="text-xs text-neutral-400">{a.jobPost.title}</div>
                      </div>
                    </div>
                    <AppStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {dims.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value || "—"}</span>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{ width: `${d.value}%` }} /></div>
            </div>
          ))}
        </div>
        {!venue.venueTrustScore && (
          <p className="text-xs text-neutral-400 mt-3 text-center">Trust Score se računa nakon prvih recenzija</p>
        )}
      </div>
    </>
  );
}

/* ── Section: Posts ──────────────────────────────────────────────────────── */

function PostsSection({ posts, loading, onNavigate, onStatusChange }: {
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

  if (loading) return <Spinner />;
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-black text-neutral-900">Moji oglasi</h2>
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

function NewPostSection({ venue, onSuccess, onBack }: {
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
        <h2 className="font-black text-neutral-900">Novi oglas</h2>
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

function ApplicationsSection({ applications, loading, onStatusChange }: {
  applications: IncomingApp[]; loading: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<AppFilter>("SVE");
  const [changing, setChanging] = useState<string | null>(null);
  if (loading) return <Spinner />;

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
      <h2 className="font-black text-neutral-900">Prijave konobara</h2>
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

/* ── InviteModal ─────────────────────────────────────────────────────────── */

function InviteModal({ waiter, posts, onClose, onSent }: {
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

function DiscoverSection({ onInvite }: { posts: OwnPost[]; onInvite: (w: WaiterEntry) => void }) {
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
      .then(data => { setWaiters(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterAvailable, filterMinScore]);

  return (
    <>
      <h2 className="font-black text-neutral-900">Pronađi konobara</h2>
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
      {loading ? <Spinner /> : waiters.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema konobara koji odgovaraju filteru</div>
        : <div className="grid gap-3 sm:grid-cols-2">
            {waiters.map(w => (
              <div key={w.id} className="dash-card p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">
                    {getInitials(w.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{w.name ?? "Konobar"}</span>
                      <TierBadge tier={w.verificationTier} />
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

function WaitersSection({ applications, loading, onInvite }: { applications: IncomingApp[]; loading: boolean; onInvite: (w: WaiterEntry) => void }) {
  if (loading) return <Spinner />;
  const unique = Object.values(
    applications.reduce<Record<string, IncomingApp>>((acc, a) => {
      if (!acc[a.waiter.id]) acc[a.waiter.id] = a;
      return acc;
    }, {})
  );
  return (
    <>
      <h2 className="font-black text-neutral-900">Konobari koji su se prijavili</h2>
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

/* ── Section: Reviews ────────────────────────────────────────────────────── */

function ReviewsSection() {
  return (
    <>
      <h2 className="font-black text-neutral-900">Recenzije konobara o lokalu</h2>
      <div className="flex flex-col gap-4">
        {REVIEWS.map(r => (
          <div key={r.id} className="dash-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-bold text-neutral-900">{r.waiter}</div><Stars n={r.rating} /></div>
              <span className="text-xs text-neutral-400 flex-shrink-0">{r.date}</span>
            </div>
            <p className="text-sm text-neutral-600 mt-3 leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Profile ────────────────────────────────────────────────────── */

function VenueCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", address: "", municipality: "", venueType: "RESTAURANT",
    latitude: "", longitude: "", capacity: "", description: "",
    phone: "", website: "", instagram: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        municipality: form.municipality,
        venueType: form.venueType,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        description: form.description || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        instagram: form.instagram || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška pri registraciji lokala.");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-black text-neutral-900">Registruj lokal</h2>
      <div className="dash-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv lokala *</label>
          <input type="text" required value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="npr. Kafana Kod Mene" className="auth-input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Adresa *</label>
            <input type="text" required value={form.address}
              onChange={e => set("address", e.target.value)}
              placeholder="npr. Skadarska 5" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Opština *</label>
            <input type="text" required value={form.municipality}
              onChange={e => set("municipality", e.target.value)}
              placeholder="npr. Stari Grad" className="auth-input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tip lokala *</label>
            <select required value={form.venueType}
              onChange={e => set("venueType", e.target.value)} className="auth-input">
              <option value="RESTAURANT">Restoran</option>
              <option value="CAFE">Kafić</option>
              <option value="BAR">Bar</option>
              <option value="CATERING">Ketering</option>
              <option value="HOTEL">Hotel</option>
              <option value="EVENT">Event</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kapacitet mesta</label>
            <input type="number" min={1} value={form.capacity}
              onChange={e => set("capacity", e.target.value)}
              placeholder="npr. 50" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Koordinate *</label>
          <p className="text-xs text-neutral-400 mb-2">
            Otvorite Google Maps → desni klik na lokaciju → kliknite na koordinate da ih kopirate
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="number" step="any" required value={form.latitude}
              onChange={e => set("latitude", e.target.value)}
              placeholder="Geografska širina (npr. 44.8125)" className="auth-input" />
            <input type="number" step="any" required value={form.longitude}
              onChange={e => set("longitude", e.target.value)}
              placeholder="Geografska dužina (npr. 20.4612)" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kratki opis</label>
          <textarea value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Kratki opis vašeg lokala..." rows={3}
            className="auth-input resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Telefon</label>
            <input type="tel" value={form.phone}
              onChange={e => set("phone", e.target.value)}
              placeholder="+381 11 123 4567" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Vebsajt</label>
            <input type="url" value={form.website}
              onChange={e => set("website", e.target.value)}
              placeholder="https://vaslokal.rs" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Instagram</label>
            <input type="text" value={form.instagram}
              onChange={e => set("instagram", e.target.value)}
              placeholder="@vaslokal" className="auth-input" />
          </div>
        </div>
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}
      <button type="submit" disabled={saving}
        className="btn-dash-orange px-6 py-2.5 self-start disabled:opacity-60">
        {saving ? "Registrovanje..." : "Registruj lokal"}
      </button>
    </form>
  );
}

function ProfileSection({ venue, loading, onVenueCreated }: {
  venue: Venue | null; loading: boolean; onVenueCreated: () => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [imgSaving, setImgSaving] = useState(false);

  useEffect(() => { setImages(venue?.images ?? []); }, [venue?.images]);

  async function saveImages(next: string[]) {
    if (!venue) return;
    setImgSaving(true);
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    setImages(next);
    setImgSaving(false);
  }

  if (loading) return <Spinner />;
  if (!venue) return <VenueCreateForm onCreated={onVenueCreated} />;

  const score = Math.round(venue.trustScore) || 0;
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;
  const dims = trustDimensions(venue.venueTrustScore);

  const infoFields = [
    { label: "Adresa",          value: venue.address },
    { label: "Opština",         value: venue.municipality },
    { label: "Telefon",         value: venue.phone ?? "—" },
    { label: "Vebsajt",         value: venue.website ?? "—" },
    { label: "Instagram",       value: venue.instagram ?? "—" },
    { label: "Kapacitet",       value: venue.capacity ? `${venue.capacity} mesta` : "—" },
    { label: "Cenovni raspon",  value: venue.priceRangeMin && venue.priceRangeMax
        ? `${venue.priceRangeMin.toLocaleString("sr-RS")} – ${venue.priceRangeMax.toLocaleString("sr-RS")} RSD/h` : "—" },
  ];

  return (
    <>
      <h2 className="font-black text-neutral-900">Profil lokala</h2>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center">
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f0efec" strokeWidth="10" />
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f97316" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-neutral-900">{score || "—"}</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">trust skor</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-neutral-900">{venue.name}</h3>
          <p className="text-sm text-neutral-500 mt-0.5">{venue.address} · {venue.municipality} · {venue.city}</p>
          <div className="flex gap-2 flex-wrap mt-3">
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}</span>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full">Aktivan</span>
          </div>
        </div>
        <button className="btn-dash-outline px-4 py-2 self-start">Uredi profil</button>
      </div>
      <div className="dash-card p-5 grid gap-4 sm:grid-cols-2">
        {infoFields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-xs text-neutral-400 font-medium mb-0.5">{label}</div>
            <div className="text-sm font-semibold text-neutral-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Photos */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-sm">Fotografije lokala</h3>
          <span className="text-xs text-neutral-400">{images.length}/8</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((src, i) => (
            <div key={src} className="relative group rounded-xl overflow-hidden aspect-video bg-neutral-100">
              <Image src={src} alt="" fill className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  Naslovna
                </span>
              )}
              <button
                onClick={() => saveImages(images.filter((_, j) => j !== i))}
                disabled={imgSaving}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}

          {images.length < 8 && (
            <div className="aspect-video">
              <ImageUpload
                uploadType="venue-photo"
                className="h-full"
                onUpload={async (url) => saveImages([...images, url])}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-400">
          Prva slika je naslovna fotografija prikazana u pretrazi. Maks. 8 slika.
        </p>
      </div>

      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {dims.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value || "—"}</span>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{ width: `${d.value}%` }} /></div>
            </div>
          ))}
        </div>
        {!venue.venueTrustScore && <p className="text-xs text-neutral-400 mt-3 text-center">Trust Score se računa nakon prvih recenzija</p>}
      </div>
    </>
  );
}

/* ── Shift modal ─────────────────────────────────────────────────────────── */

function ShiftModal({ shift, date, venue, waiters, onSave, onDelete, onClose }: {
  shift: VenueShift | null;
  date: Date | null;
  venue: Venue;
  waiters: { id: string; name: string | null }[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const toInput = (d: Date) => d.toLocaleDateString("sv-SE"); // "YYYY-MM-DD"
  const [form, setForm] = useState({
    title:     shift?.title     ?? "",
    date:      shift ? shift.date.slice(0, 10) : (date ? toInput(date) : ""),
    startTime: shift?.startTime ?? "18:00",
    endTime:   shift?.endTime   ?? "02:00",
    role:      shift?.role      ?? "",
    pay:       shift?.pay?.toString() ?? "",
    waiterIds: shift?.waiters.map(w => w.id) ?? [] as string[],
    notes:     shift?.notes     ?? "",
  });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError]       = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const toggleWaiter = (id: string) =>
    setForm(p => ({
      ...p,
      waiterIds: p.waiterIds.includes(id)
        ? p.waiterIds.filter(w => w !== id)
        : [...p.waiterIds, id],
    }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url    = shift ? `/api/shifts/${shift.id}` : "/api/shifts";
    const method = shift ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:   venue.id,
        title:     form.title,
        date:      form.date,
        startTime: form.startTime,
        endTime:   form.endTime,
        role:      form.role  || undefined,
        pay:       form.pay   ? Number(form.pay) : undefined,
        waiterIds: form.waiterIds,
        notes:     form.notes || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    onSave();
  }

  async function handleDelete() {
    if (!shift) return;
    setDeleting(true);
    await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
    setDeleting(false);
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">{shift ? "Uredi smenu" : "Nova smena"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naziv smene *</label>
            <input type="text" required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="npr. Večernja smena" className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Datum *</label>
            <input type="date" required value={form.date} onChange={e => set("date", e.target.value)}
              className="auth-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od *</label>
              <input type="time" required value={form.startTime} onChange={e => set("startTime", e.target.value)}
                className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do *</label>
              <input type="time" required value={form.endTime} onChange={e => set("endTime", e.target.value)}
                className="auth-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Uloga</label>
              <input type="text" value={form.role} onChange={e => set("role", e.target.value)}
                placeholder="npr. Konobar" className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naknada (RSD)</label>
              <input type="number" min={0} value={form.pay} onChange={e => set("pay", e.target.value)}
                placeholder="npr. 3 000" className="auth-input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Konobari</label>
            {waiters.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Nema prihvaćenih konobara za ovaj lokal.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto border border-neutral-200 rounded-xl p-2">
                {waiters.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.waiterIds.includes(w.id)}
                      onChange={() => toggleWaiter(w.id)}
                      className="w-4 h-4 rounded accent-orange-500 flex-shrink-0"
                    />
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-[9px] flex-shrink-0">
                      {getInitials(w.name)}
                    </div>
                    <span className="text-sm text-neutral-700">{w.name ?? w.id.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Napomena</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              rows={2} className="auth-input resize-none" />
          </div>
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-dash-orange flex-1 py-2.5 disabled:opacity-60">
              {saving ? "Čuvanje..." : (shift ? "Sačuvaj" : "Dodaj smenu")}
            </button>
            {shift && !confirmDel && (
              <button type="button" onClick={() => setConfirmDel(true)}
                className="btn-dash-outline px-4 py-2.5 text-red-400 hover:border-red-300 hover:text-red-500">
                Obriši
              </button>
            )}
            {shift && confirmDel && (
              <button type="button" disabled={deleting} onClick={handleDelete}
                className="btn-dash-outline px-4 py-2.5 border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-60">
                {deleting ? "..." : "Potvrdi?"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Section: Smene (venue) ──────────────────────────────────────────────── */

function VenueSmeneSection({ venue, shifts, loading, acceptedWaiters, onRefresh }: {
  venue: Venue | null;
  shifts: VenueShift[];
  loading: boolean;
  acceptedWaiters: { id: string; name: string | null }[];
  onRefresh: () => void;
}) {
  const now = new Date();
  const [current, setCurrent]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [creating, setCreating] = useState<Date | null>(null);
  const [editing, setEditing]   = useState<VenueShift | null>(null);

  if (loading) return <Spinner />;
  if (!venue)  return <EmptyVenue onNavigate={() => {}} />;

  const year  = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayNum    = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const shiftsByDay: Record<number, VenueShift[]> = {};
  for (const s of shifts) {
    const d = new Date(s.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!shiftsByDay[day]) shiftsByDay[day] = [];
      shiftsByDay[day].push(s);
    }
  }

  const upcoming = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <>
      {(creating || editing) && (
        <ShiftModal
          shift={editing}
          date={creating}
          venue={venue}
          waiters={acceptedWaiters}
          onSave={() => { setCreating(null); setEditing(null); onRefresh(); }}
          onDelete={() => { setEditing(null); onRefresh(); }}
          onClose={() => { setCreating(null); setEditing(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-black text-neutral-900">Smene</h2>
        <button onClick={() => setCreating(now)} className="btn-dash-orange px-4 py-2">+ Nova smena</button>
      </div>

      {/* Calendar card */}
      <div className="dash-card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="font-bold text-neutral-900">{MONTHS_SR[month]} {year}</span>
            {!isCurrentMonth && (
              <button onClick={() => setCurrent(new Date(now.getFullYear(), now.getMonth(), 1))}
                className="text-xs text-orange-500 font-semibold hover:underline">Danas</button>
            )}
          </div>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-neutral-100">
          {DAYS_SR.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-neutral-400 py-2.5">{d}</div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum     = i - firstDay + 1;
            const isValid    = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday    = dayNum === todayNum;
            const isLastInRow = (i + 1) % 7 === 0;
            const isLastRow  = i >= totalCells - 7;
            const dayShifts  = isValid ? (shiftsByDay[dayNum] ?? []) : [];
            return (
              <div key={i}
                onClick={() => { if (isValid) setCreating(new Date(year, month, dayNum)); }}
                className={[
                  "min-h-[84px] p-1.5",
                  !isLastInRow && "border-r border-neutral-100",
                  !isLastRow   && "border-b border-neutral-100",
                  isValid ? "cursor-pointer hover:bg-orange-50/60 transition-colors" : "bg-neutral-50/40",
                ].filter(Boolean).join(" ")}>
                {isValid && (
                  <>
                    <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-orange-500 text-white" : "text-neutral-500"}`}>
                      {dayNum}
                    </div>
                    <div className="flex flex-col gap-0">
                      {dayShifts.slice(0, 2).map((s, idx) => (
                        <div key={s.id}>
                          {idx > 0 && <div className="h-px bg-neutral-300/60 my-0.5 mx-0.5" />}
                          <div
                            onClick={e => { e.stopPropagation(); setEditing(s); }}
                            title="Kliknite za uređivanje"
                            className={`text-[10px] font-semibold px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity flex items-center gap-1 min-w-0 ${s.waiters.length > 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                            {s.waiters.length > 0 ? (
                              <div className="flex -space-x-1 flex-shrink-0">
                                {s.waiters.slice(0, 3).map(w => (
                                  <span key={w.id}
                                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-black leading-none ring-1 ring-white"
                                    style={{ fontSize: "7px", background: "#15803d" }}>
                                    {getInitials(w.name)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-current opacity-40" />
                            )}
                            <span className="truncate">{s.startTime}</span>
                          </div>
                        </div>
                      ))}
                      {dayShifts.length > 2 && (
                        <div className="text-[10px] text-neutral-400 font-medium px-1">+{dayShifts.length - 2}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" />Nedodeljena smena
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />Dodeljena smena (1+ konobara)
        </span>
        <span className="text-neutral-400">Kliknite na dan za novu smenu · kliknite na smenu za uređivanje</span>
      </div>

      {/* Upcoming list */}
      {upcoming.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-3">Nadolazeće smene</h3>
          <div className="flex flex-col gap-0">
            {upcoming.map(s => {
              const dateStr = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={s.id} onClick={() => setEditing(s)}
                  className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0 cursor-pointer hover:opacity-75 transition-opacity">
                  <div>
                    <div className="text-sm font-semibold text-neutral-800">{s.title}{s.role && <span className="ml-1.5 text-[11px] text-neutral-400 font-normal">· {s.role}</span>}</div>
                    <div className="text-xs text-neutral-400 mt-0.5 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {s.waiters.length > 0
                      ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{s.waiters.map(w => w.name ?? "Konobar").join(", ")}</span>
                      : <span className="text-xs font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">Nedodeljena</span>
                    }
                    {s.pay && <div className="text-xs font-black text-orange-500 mt-0.5">{s.pay.toLocaleString("sr-RS")} RSD</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shifts.length === 0 && (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">
          Nema smena — kliknite na dan u kalendaru ili koristite &quot;+ Nova smena&quot;
        </div>
      )}
    </>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview",     label: "Pregled",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "posts",        label: "Oglasi",        icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { key: "smene",        label: "Smene",         icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "applications", label: "Prijave",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg> },
  { key: "waiters",      label: "Konobari",      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { key: "discover",     label: "Pronađi",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { key: "reviews",      label: "Recenzije",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
  { key: "profile",      label: "Profil lokala", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: "Pregled", posts: "Oglasi", "new-post": "Novi oglas", smene: "Smene",
  applications: "Prijave", waiters: "Konobari", discover: "Pronađi konobara",
  reviews: "Recenzije", profile: "Profil lokala",
};

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function VenueDashboard() {
  const { data: session } = useSession();
  const [section, setSection]           = useState<Section>("overview");
  const [venue, setVenue]               = useState<Venue | null>(null);
  const [posts, setPosts]               = useState<OwnPost[]>([]);
  const [applications, setApplications] = useState<IncomingApp[]>([]);
  const [shifts, setShifts]             = useState<VenueShift[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [inviteTarget, setInviteTarget] = useState<WaiterEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [venuesRes, postsRes, appsRes, shiftsRes] = await Promise.all([
      fetch("/api/venues"),
      fetch("/api/jobs"),
      fetch("/api/jobs/applications"),
      fetch("/api/shifts"),
    ]);
    if (venuesRes.ok) { const vs: Venue[] = await venuesRes.json(); setVenue(vs[0] ?? null); }
    if (postsRes.ok)  setPosts(await postsRes.json());
    if (appsRes.ok)   setApplications(await appsRes.json());
    if (shiftsRes.ok) setShifts(await shiftsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (appId: string, status: string) => {
    await fetch(`/api/jobs/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const handlePostStatusChange = async (postId: string, status: "ACTIVE" | "PAUSED") => {
    await fetch(`/api/jobs/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const userName        = session?.user?.name ?? venue?.name ?? "Lokal";
  const initials        = getInitials(userName);
  const pendingCount    = applications.filter(a => a.status === "PENDING").length;
  const acceptedWaiters = [...new Map(
    applications
      .filter(a => a.status === "ACCEPTED")
      .map(a => [a.waiter.id, { id: a.waiter.id, name: a.waiter.name }])
  ).values()];
  const today = new Date().toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const navContent = (closeMenu?: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{item.label}
            {item.key === "applications" && pendingCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-neutral-900 truncate">{venue?.name ?? userName}</div>
            <div className="text-[11px] text-neutral-400 truncate">Vlasnik lokala</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-item text-red-400 hover:bg-red-50 hover:text-red-500 w-full">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Odjavi se
        </button>
      </div>
    </>
  );

  return (
    <>
    <div className="flex min-h-screen" style={{ background: "#F6F5F2" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "white", borderRight: "1px solid #f0efec" }}>
        <div className="px-5 py-5 border-b border-neutral-100 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">eK</div>
            <span className="font-black text-neutral-900 text-base">eKonobar</span>
          </Link>
          <button onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {navContent(() => setMobileOpen(false))}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen sticky top-0 h-screen overflow-y-auto"
        style={{ background: "white", borderRight: "1px solid #f0efec" }}>
        <div className="px-5 py-5 border-b border-neutral-100">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">eK</div>
            <span className="font-black text-neutral-900 text-base">eKonobar</span>
          </Link>
        </div>
        {navContent()}
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "rgba(246,245,242,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #f0efec" }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden w-9 h-9 rounded-xl bg-white border border-neutral-100 flex items-center justify-center hover:border-orange-300 transition-colors"
              onClick={() => setMobileOpen(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <h1 className="font-black text-neutral-900 text-lg">{SECTION_TITLES[section]}</h1>
              <p className="text-xs text-neutral-400 capitalize">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-white border border-neutral-100 flex items-center justify-center hover:border-orange-300 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />}
            </button>
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">{initials}</div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
          {section === "overview"     && <OverviewSection venue={venue} posts={posts} applications={applications} loading={loading} onNavigate={setSection} />}
          {section === "posts"        && <PostsSection posts={posts} loading={loading} onNavigate={setSection} onStatusChange={handlePostStatusChange} />}
          {section === "new-post"     && <NewPostSection venue={venue} onSuccess={() => { fetchData(); setSection("posts"); }} onBack={() => setSection("posts")} />}
          {section === "smene"        && <VenueSmeneSection venue={venue} shifts={shifts} loading={loading} acceptedWaiters={acceptedWaiters} onRefresh={fetchData} />}
          {section === "applications" && <ApplicationsSection applications={applications} loading={loading} onStatusChange={handleStatusChange} />}
          {section === "waiters"      && <WaitersSection applications={applications} loading={loading} onInvite={setInviteTarget} />}
          {section === "discover"     && <DiscoverSection posts={posts} onInvite={setInviteTarget} />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "profile"      && <ProfileSection venue={venue} loading={loading} onVenueCreated={fetchData} />}
        </div>
      </main>
    </div>

    {inviteTarget && (
      <InviteModal
        waiter={inviteTarget}
        posts={posts}
        onClose={() => setInviteTarget(null)}
        onSent={() => setInviteTarget(null)}
      />
    )}
    </>
  );
}
