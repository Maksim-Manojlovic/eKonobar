"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

type Section = "overview" | "posts" | "applications" | "waiters" | "reviews" | "profile";
type PostStatus = "ACTIVE" | "PAUSED" | "FILLED";
type AppStatus = "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";
type AppFilter = "SVE" | AppStatus;

/* ── Static placeholder data ─────────────────────────────────────────────── */

const JOB_POSTS: {
  id: number; title: string; type: string; pay: string;
  applicants: number; status: PostStatus; redAlert: boolean; posted: string;
}[] = [
  { id: 1, title: "Senior Konobar", type: "Stalno", pay: "85 000–100 000 RSD/mes", applicants: 12, status: "ACTIVE", redAlert: false, posted: "28 Apr 2026" },
  { id: 2, title: "Konobar — vikend smene", type: "Vikend", pay: "3 200 RSD/sm", applicants: 8, status: "ACTIVE", redAlert: true, posted: "30 Apr 2026" },
  { id: 3, title: "Šank-asistent", type: "Honorarno", pay: "2 800 RSD/sm", applicants: 5, status: "PAUSED", redAlert: false, posted: "20 Apr 2026" },
  { id: 4, title: "Konobar za proslavu", type: "Slavlje", pay: "4 000 RSD/sm", applicants: 3, status: "FILLED", redAlert: false, posted: "10 Apr 2026" },
];

const APPLICATIONS: {
  id: number; waiter: string; initials: string; post: string; score: number;
  tier: string; appliedAt: string; status: AppStatus; badges: string[];
}[] = [
  { id: 1, waiter: "Marko Nikolić",   initials: "MN", post: "Senior Konobar",      score: 92, tier: "GOLD",   appliedAt: "1 Maj 2026",  status: "PENDING",     badges: ["Sanitarna ✓", "Engleski B2", "Somelijer"] },
  { id: 2, waiter: "Ana Petrović",    initials: "AP", post: "Senior Konobar",      score: 87, tier: "GOLD",   appliedAt: "30 Apr 2026", status: "SHORTLISTED", badges: ["Sanitarna ✓", "Engleski B1"] },
  { id: 3, waiter: "Nikola Jović",    initials: "NJ", post: "Konobar — vikend",    score: 74, tier: "SILVER", appliedAt: "30 Apr 2026", status: "PENDING",     badges: ["Sanitarna ✓"] },
  { id: 4, waiter: "Jovana Milić",    initials: "JM", post: "Senior Konobar",      score: 95, tier: "GOLD",   appliedAt: "29 Apr 2026", status: "ACCEPTED",    badges: ["Sanitarna ✓", "Somelijer", "Fine Dining"] },
  { id: 5, waiter: "Stefan Đorđević", initials: "SĐ", post: "Šank-asistent",       score: 61, tier: "SILVER", appliedAt: "28 Apr 2026", status: "REJECTED",    badges: [] },
  { id: 6, waiter: "Maja Stojanović", initials: "MS", post: "Konobar — vikend",    score: 80, tier: "GOLD",   appliedAt: "28 Apr 2026", status: "PENDING",     badges: ["Sanitarna ✓", "Nemački B1"] },
];

const WAITERS = [
  { id: 1, name: "Marko Nikolić",   initials: "MN", score: 92, tier: "GOLD",   shifts: 127, rating: 4.9, available: true,  badges: ["Sanitarna ✓", "Engleski B2", "Somelijer"] },
  { id: 2, name: "Ana Petrović",    initials: "AP", score: 87, tier: "GOLD",   shifts: 89,  rating: 4.7, available: true,  badges: ["Sanitarna ✓", "Engleski B1"] },
  { id: 3, name: "Jovana Milić",    initials: "JM", score: 95, tier: "GOLD",   shifts: 203, rating: 4.9, available: false, badges: ["Sanitarna ✓", "Somelijer", "Fine Dining"] },
  { id: 4, name: "Nikola Jović",    initials: "NJ", score: 74, tier: "SILVER", shifts: 41,  rating: 4.3, available: true,  badges: ["Sanitarna ✓"] },
];

const REVIEWS = [
  { id: 1, waiter: "Jovana Milić",    rating: 5, date: "15 Apr 2026", text: "Izuzetna profesionalka. Smirena u najluđim noćima, gosti je obožavaju. Definitivno ćemo je ponovo pozvati." },
  { id: 2, waiter: "Marko Nikolić",   rating: 5, date: "2 Apr 2026",  text: "Tačan, brz, komunikativan. Bez ikakvih primedbi — preporučujem svim lokalima." },
  { id: 3, waiter: "Stefan Đorđević", rating: 3, date: "18 Mar 2026", text: "Solidan rad, ali kasnio 15 minuta na početak smene. Treba mu još prakse u fine-dining okruženju." },
];

const TRUST_DIMENSIONS = [
  { label: "Atmosfera", value: 88 },
  { label: "Organizacija", value: 76 },
  { label: "Isplata", value: 92 },
  { label: "Bakšiš sistem", value: 84 },
  { label: "Higijena", value: 90 },
  { label: "Menadžment", value: 79 },
];

/* ── Helper components ────────────────────────────────────────────────────── */

function PostStatusBadge({ status }: { status: PostStatus }) {
  if (status === "ACTIVE")  return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Aktivan</span>;
  if (status === "PAUSED")  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Pauziran</span>;
  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Popunjen</span>;
}

function AppStatusBadge({ status }: { status: AppStatus }) {
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
  return (
    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
      {score}
    </span>
  );
}

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const circumference = 2 * Math.PI * 40;
  const score = 86;
  const offset = circumference - (score / 100) * circumference;

  const pendingCount = APPLICATIONS.filter((a) => a.status === "PENDING").length;
  const activeCount  = JOB_POSTS.filter((p) => p.status === "ACTIVE").length;

  return (
    <>
      {/* Venue card */}
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f0efec" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="40" fill="none"
              stroke="#f97316" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-neutral-900">{score}</span>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">trust</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex gap-2 flex-wrap mb-1">
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />
              Aktivan
            </span>
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">🍽️ Restoran</span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900">Kafana Skadarlija</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Skadarska 32, Beograd · Stari Grad</p>

          <div className="flex gap-6 mt-4">
            {[
              { label: "Aktivni oglasi", value: String(activeCount) },
              { label: "Prijave", value: String(APPLICATIONS.length) },
              { label: "Ocena", value: "4.6" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => onNavigate("posts")} className="btn-dash-orange px-4 py-2 self-start whitespace-nowrap">
          + Novi oglas
        </button>
      </div>

      {/* Pending applications alert */}
      {pendingCount > 0 && (
        <div
          className="alert-card p-4 flex items-center gap-3 cursor-pointer"
          onClick={() => onNavigate("applications")}
        >
          <div className="relative w-4 h-4 flex-shrink-0">
            <span className="pulse-ring w-4 h-4" />
            <span className="pulse-ring-2 w-4 h-4" />
            <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>
          <div className="flex-1">
            <span className="font-bold text-neutral-900 text-sm">
              {pendingCount} prijav{pendingCount === 1 ? "a čeka" : "e čekaju"} na odgovor
            </span>
            <p className="text-xs text-neutral-500">Kliknite da pregledite i odlučite</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Active posts mini */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Aktivni oglasi</h3>
            <button onClick={() => onNavigate("posts")} className="text-xs text-orange-500 font-semibold hover:underline">Svi</button>
          </div>
          <div className="flex flex-col gap-2">
            {JOB_POSTS.filter((p) => p.status === "ACTIVE").map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div>
                  <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                    {p.title}
                    {p.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">⚡ RED</span>}
                  </div>
                  <div className="text-xs text-neutral-400">{p.type} · {p.applicants} prijav{p.applicants === 1 ? "a" : "a"}</div>
                </div>
                <PostStatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent applications mini */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Nedavne prijave</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          <div className="flex flex-col gap-2">
            {APPLICATIONS.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-[11px] flex-shrink-0">
                    {a.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-800">{a.waiter}</div>
                    <div className="text-xs text-neutral-400">{a.post}</div>
                  </div>
                </div>
                <AppStatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust score breakdown */}
      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRUST_DIMENSIONS.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value}</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${d.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Section: Job Posts ───────────────────────────────────────────────────── */

function PostsSection() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-black text-neutral-900">Moji oglasi</h2>
        <button className="btn-dash-orange px-4 py-2">+ Novi oglas</button>
      </div>

      <div className="flex flex-col gap-3">
        {JOB_POSTS.map((p) => (
          <div key={p.id} className="dash-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900">{p.title}</span>
                  {p.redAlert && (
                    <span className="text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">⚡ Red Alert</span>
                  )}
                  <PostStatusBadge status={p.status} />
                </div>
                <div className="text-sm text-neutral-500 mt-0.5">{p.type} · {p.pay}</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Objavljen {p.posted} · <span className="font-semibold text-neutral-600">{p.applicants} prijav{p.applicants === 1 ? "a" : "e"}</span>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {p.status === "ACTIVE" && (
                  <button className="btn-dash-outline px-3 py-1.5 text-xs">Pauziraj</button>
                )}
                {p.status === "PAUSED" && (
                  <button className="btn-dash-orange px-3 py-1.5 text-xs">Aktiviraj</button>
                )}
                <button className="btn-dash-outline px-3 py-1.5 text-xs">Uredi</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

function ApplicationsSection() {
  const [filter, setFilter] = useState<AppFilter>("SVE");

  const filtered = filter === "SVE" ? APPLICATIONS : APPLICATIONS.filter((a) => a.status === filter);

  const tabs: { key: AppFilter; label: string }[] = [
    { key: "SVE",         label: "Sve" },
    { key: "PENDING",     label: "Na čekanju" },
    { key: "SHORTLISTED", label: "Shortlist" },
    { key: "ACCEPTED",    label: "Prihvaćene" },
    { key: "REJECTED",    label: "Odbijene" },
  ];

  return (
    <>
      <h2 className="font-black text-neutral-900">Prijave konobara</h2>

      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}
          >
            {t.label}
            {t.key === "PENDING" && (
              <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full inline-flex items-center justify-center">
                {APPLICATIONS.filter((a) => a.status === "PENDING").length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((a) => (
          <div key={a.id} className="dash-card p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                {a.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900">{a.waiter}</span>
                  <TierBadge tier={a.tier} />
                  <ScorePill score={a.score} />
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">Oglas: {a.post} · {a.appliedAt}</div>
                {a.badges.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {a.badges.map((b) => (
                      <span key={b} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <AppStatusBadge status={a.status} />
                {a.status === "PENDING" && (
                  <div className="flex gap-1.5">
                    <button className="btn-dash-orange px-3 py-1.5 text-[11px]">Prihvati</button>
                    <button className="btn-dash-outline px-3 py-1.5 text-[11px]">Odbij</button>
                  </div>
                )}
                {a.status === "SHORTLISTED" && (
                  <div className="flex gap-1.5">
                    <button className="btn-dash-orange px-3 py-1.5 text-[11px]">Prihvati</button>
                    <button className="btn-dash-outline px-3 py-1.5 text-[11px]">Odbij</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Waiters ────────────────────────────────────────────────────── */

function WaitersSection() {
  return (
    <>
      <h2 className="font-black text-neutral-900">Konobari koji su se prijavili</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {WAITERS.map((w) => (
          <div key={w.id} className="dash-card p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                {w.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900">{w.name}</span>
                  <TierBadge tier={w.tier} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <ScorePill score={w.score} />
                  <span className="text-xs text-neutral-400">{w.shifts} smena · ★{w.rating}</span>
                </div>
                {w.badges.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {w.badges.map((b) => (
                      <span key={b} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.available ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
                  {w.available ? "Dostupan" : "Zauzet"}
                </span>
                <button className="btn-dash-orange px-3 py-1.5 text-[11px] mt-1">Pozovi</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Reviews ────────────────────────────────────────────────────── */

function ReviewsSection() {
  return (
    <>
      <h2 className="font-black text-neutral-900">Recenzije konobara o lokalu</h2>
      <div className="flex flex-col gap-4">
        {REVIEWS.map((r) => (
          <div key={r.id} className="dash-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-900">{r.waiter}</div>
                <div className="mt-0.5"><Stars n={r.rating} /></div>
              </div>
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

function ProfileSection() {
  const circumference = 2 * Math.PI * 46;
  const score = 86;
  const offset = circumference - (score / 100) * circumference;

  return (
    <>
      <h2 className="font-black text-neutral-900">Profil lokala</h2>

      {/* Score card */}
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center">
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f0efec" strokeWidth="10" />
            <circle
              cx="56" cy="56" r="46" fill="none"
              stroke="#f97316" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-neutral-900">{score}</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">trust skor</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-neutral-900">Kafana Skadarlija</h3>
          <p className="text-sm text-neutral-500 mt-0.5">Skadarska 32 · Stari Grad · Beograd</p>
          <div className="flex gap-2 flex-wrap mt-3">
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">🍽️ Restoran</span>
            <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-0.5 rounded-full">Kapacitet: 80</span>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full">Aktivan</span>
          </div>
        </div>
        <button className="btn-dash-outline px-4 py-2 self-start">Uredi profil</button>
      </div>

      {/* Info fields */}
      <div className="dash-card p-5 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Adresa",     value: "Skadarska 32, Beograd" },
          { label: "Opština",    value: "Stari Grad" },
          { label: "Telefon",    value: "+381 11 123 4567" },
          { label: "Vebsajt",    value: "kafanaskadarlija.rs" },
          { label: "Instagram",  value: "@kafanaskadarlija" },
          { label: "Cenovni raspon", value: "2 000 – 4 500 RSD/h" },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-xs text-neutral-400 font-medium mb-0.5">{label}</div>
            <div className="text-sm font-semibold text-neutral-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Trust breakdown */}
      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRUST_DIMENSIONS.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value}</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${d.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Nav items ───────────────────────────────────────────────────────────── */

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Pregled",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "posts",
    label: "Oglasi",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    key: "applications",
    label: "Prijave",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  },
  {
    key: "waiters",
    label: "Konobari",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "reviews",
    label: "Recenzije",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profil lokala",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

const SECTION_TITLES: Record<Section, string> = {
  overview:     "Pregled",
  posts:        "Oglasi",
  applications: "Prijave",
  waiters:      "Konobari",
  reviews:      "Recenzije",
  profile:      "Profil lokala",
};

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function VenueDashboard() {
  const [section, setSection] = useState<Section>("overview");

  const pendingCount = APPLICATIONS.filter((a) => a.status === "PENDING").length;

  const today = new Date().toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "#F6F5F2" }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen sticky top-0 h-screen overflow-y-auto"
        style={{ background: "white", borderRight: "1px solid #f0efec" }}
      >
        <div className="px-5 py-5 border-b border-neutral-100">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">
              eK
            </div>
            <span className="font-black text-neutral-900 text-base">eKonobar</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`nav-item ${section === item.key ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
              {item.key === "applications" && pendingCount > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
              KS
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-900 truncate">Kafana Skadarlija</div>
              <div className="text-[11px] text-neutral-400 truncate">Vlasnik lokala</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="nav-item text-red-400 hover:bg-red-50 hover:text-red-500 w-full"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Odjavi se
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "rgba(246,245,242,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #f0efec" }}
        >
          <div>
            <h1 className="font-black text-neutral-900 text-lg">{SECTION_TITLES[section]}</h1>
            <p className="text-xs text-neutral-400 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-white border border-neutral-100 flex items-center justify-center hover:border-orange-300 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />}
            </button>
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
              KS
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
          {section === "overview"     && <OverviewSection onNavigate={setSection} />}
          {section === "posts"        && <PostsSection />}
          {section === "applications" && <ApplicationsSection />}
          {section === "waiters"      && <WaitersSection />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "profile"      && <ProfileSection />}
        </div>
      </main>
    </div>
  );
}
