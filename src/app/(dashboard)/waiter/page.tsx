"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

type Section = "overview" | "alerts" | "jobs" | "applications" | "shifts" | "reviews" | "passport";
type AppStatus = "accepted" | "pending" | "rejected";
type AppFilter = "all" | AppStatus;

/* ── Static placeholder data ─────────────────────────────────────────────── */

const ALERTS = [
  { id: 1, venue: "Kafana Skadarlija", role: "Konobar", date: "Petak, 2 Maj", time: "18:00 – 02:00", pay: "3 200 RSD", urgent: true },
  { id: 2, venue: "Restoran ? (Znak Pitanja)", role: "Šank-asistent", date: "Subota, 3 Maj", time: "12:00 – 20:00", pay: "2 800 RSD", urgent: false },
  { id: 3, venue: "Kafić Nemanjina 8", role: "Konobar", date: "Nedelja, 4 Maj", time: "10:00 – 18:00", pay: "2 500 RSD", urgent: false },
];

const SHIFTS = [
  { id: 1, venue: "Kafana Skadarlija", role: "Konobar", date: "Petak, 2 Maj", time: "18:00 – 02:00", pay: "3 200 RSD" },
  { id: 2, venue: "Restoran Dva Jelena", role: "Konobar", date: "Subota, 3 Maj", time: "16:00 – 00:00", pay: "2 900 RSD" },
  { id: 3, venue: "Bar Mixer", role: "Šank-asistent", date: "Ponedeljak, 5 Maj", time: "20:00 – 04:00", pay: "3 100 RSD" },
  { id: 4, venue: "Kafić Urban", role: "Konobar", date: "Sreda, 7 Maj", time: "08:00 – 16:00", pay: "2 200 RSD" },
];

const APPLICATIONS: { id: number; venue: string; role: string; date: string; status: AppStatus }[] = [
  { id: 1, venue: "Kafana Skadarlija", role: "Konobar", date: "28 Apr 2026", status: "accepted" },
  { id: 2, venue: "Club Sindikat", role: "Šank-asistent", date: "26 Apr 2026", status: "pending" },
  { id: 3, venue: "Restoran Šešir Moj", role: "Konobar", date: "24 Apr 2026", status: "rejected" },
  { id: 4, venue: "Kafić Urban", role: "Konobar", date: "22 Apr 2026", status: "pending" },
  { id: 5, venue: "Hotel Moskva Restaurant", role: "Senior Konobar", date: "20 Apr 2026", status: "accepted" },
  { id: 6, venue: "Bar Mixer", role: "Šank-asistent", date: "18 Apr 2026", status: "pending" },
];

const JOBS = [
  { id: 1, venue: "Hotel Moskva Restaurant", role: "Senior Konobar", type: "Stalno", pay: "95 000 RSD/mes", distance: "1.2 km", logo: "🏨" },
  { id: 2, venue: "Club 20/44", role: "Šank-asistent", type: "Privremeno", pay: "3 500 RSD/sm", distance: "2.8 km", logo: "🎵" },
  { id: 3, venue: "Restoran Tri Šešira", role: "Konobar", type: "Stalno", pay: "80 000 RSD/mes", distance: "0.9 km", logo: "🍽️" },
  { id: 4, venue: "Kafić Manufaktura", role: "Konobar", type: "Honorarno", pay: "2 200 RSD/sm", distance: "3.4 km", logo: "☕" },
];

const REVIEWS = [
  { id: 1, venue: "Kafana Dva Jelena", rating: 5, date: "15 Apr 2026", text: "Marko je izuzetan konobar. Brz, ljubazan i uvek sa osmehom. Definitivo ćemo ga ponovo angažovati!" },
  { id: 2, venue: "Club Sindikat", rating: 4, date: "2 Apr 2026", text: "Profesionalan i pouzdan. Malo tih ali gosti su bili zadovoljni uslugom." },
  { id: 3, venue: "Restoran Šešir Moj", rating: 5, date: "18 Mar 2026", text: "Jedan od boljih konobara koje smo imali. Poznaje meni, komunicira sa gostima i drži tempo celo veče." },
];

/* ── Helper components ────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: AppStatus }) {
  const cls =
    status === "accepted" ? "badge-accepted" : status === "pending" ? "badge-pending" : "badge-rejected";
  const label = status === "accepted" ? "Prihvaćeno" : status === "pending" ? "Na čekanju" : "Odbijeno";
  return (
    <span className={`${cls} text-xs font-semibold px-2.5 py-0.5 rounded-full`}>{label}</span>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const circumference = 2 * Math.PI * 40;
  const score = 92;
  const offset = circumference - (score / 100) * circumference;

  return (
    <>
      {/* Profile card */}
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
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
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">skor</span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-1">
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">🥇 GOLD</span>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />
              Verifikovan
            </span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900">Marko Nikolić</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Senior Konobar · Beograd</p>

          <div className="flex gap-6 mt-4 justify-center sm:justify-start">
            {[
              { label: "Prijave", value: "24" },
              { label: "Smene", value: "127" },
              { label: "Ocena", value: "4.9" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate("passport")}
          className="btn-dash-orange px-4 py-2 self-start"
        >
          Waiter Passport
        </button>
      </div>

      {/* Red Alert */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-4 h-4">
            <span className="pulse-ring w-4 h-4" />
            <span className="pulse-ring-2 w-4 h-4" />
            <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>
          <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {ALERTS.map((a) => (
            <div key={a.id} className="alert-card p-4">
              {a.urgent && (
                <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">⚡ Hitno</div>
              )}
              <div className="font-bold text-neutral-900 text-sm">{a.venue}</div>
              <div className="text-xs text-neutral-600 mt-0.5">{a.role}</div>
              <div className="text-xs text-neutral-500 mt-1">{a.date} · {a.time}</div>
              <div className="text-sm font-black text-orange-600 mt-2">{a.pay}</div>
              <button className="mt-2 w-full btn-dash-orange px-3 py-1.5 text-[11px]">Prijavi se</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row: shifts + applications mini */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Predstojeće smene</h3>
            <button onClick={() => onNavigate("shifts")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          <div className="flex flex-col gap-2">
            {SHIFTS.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">{s.venue}</div>
                  <div className="text-xs text-neutral-400">{s.date} · {s.time}</div>
                </div>
                <span className="text-sm font-bold text-orange-500">{s.pay}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Moje prijave</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          <div className="flex flex-col gap-2">
            {APPLICATIONS.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">{a.venue}</div>
                  <div className="text-xs text-neutral-400">{a.role}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Passport progress */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-neutral-900 text-sm">Waiter Passport™ napredak</h3>
            <p className="text-xs text-neutral-400">Do Platinum nivoa: još 8 bodova</p>
          </div>
          <span className="text-orange-500 font-black text-lg">84%</span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: "84%" }} />
        </div>
        <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
          <span>SILVER</span><span>GOLD ✓</span><span>PLATINUM</span>
        </div>
      </div>
    </>
  );
}

/* ── Section: Alerts ─────────────────────────────────────────────────────── */

function AlertsSection() {
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative w-4 h-4">
          <span className="pulse-ring w-4 h-4" />
          <span className="pulse-ring-2 w-4 h-4" />
          <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        </div>
        <h2 className="font-black text-neutral-900 text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h2>
      </div>
      <p className="text-xs text-neutral-400 -mt-3">Ovi angažmani zahtevaju brzu odluku. Lokali traže konobara u roku od 24h.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALERTS.map((a) => (
          <div key={a.id} className="alert-card p-5">
            {a.urgent && (
              <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">⚡ Hitno</div>
            )}
            <div className="font-bold text-neutral-900">{a.venue}</div>
            <div className="text-sm text-neutral-600 mt-0.5">{a.role}</div>
            <div className="text-xs text-neutral-500 mt-1">{a.date}</div>
            <div className="text-xs text-neutral-500">{a.time}</div>
            <div className="text-lg font-black text-orange-600 mt-3">{a.pay}</div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 btn-dash-orange px-3 py-2">Prijavi se</button>
              <button className="flex-1 btn-dash-outline px-3 py-2">Detalji</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Jobs ───────────────────────────────────────────────────────── */

function JobsSection() {
  return (
    <>
      <h2 className="font-black text-neutral-900">Dostupni poslovi</h2>
      <div className="flex flex-col gap-3">
        {JOBS.map((j) => (
          <div key={j.id} className="dash-card p-5 flex items-center gap-4">
            <div className="text-3xl w-12 h-12 flex items-center justify-center bg-orange-50 rounded-xl flex-shrink-0">
              {j.logo}
            </div>
            <div className="flex-1">
              <div className="font-bold text-neutral-900">{j.venue}</div>
              <div className="text-sm text-neutral-500">{j.role}</div>
              <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                <span>{j.type}</span>
                <span>·</span>
                <span>{j.distance}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-orange-500">{j.pay}</div>
              <button className="mt-2 btn-dash-orange px-4 py-1.5 text-xs">Prijavi se</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

function ApplicationsSection() {
  const [filter, setFilter] = useState<AppFilter>("all");

  const filtered =
    filter === "all" ? APPLICATIONS : APPLICATIONS.filter((a) => a.status === filter);

  const tabs: { key: AppFilter; label: string }[] = [
    { key: "all", label: "Sve" },
    { key: "accepted", label: "Prihvaćene" },
    { key: "pending", label: "Na čekanju" },
    { key: "rejected", label: "Odbijene" },
  ];

  return (
    <>
      <h2 className="font-black text-neutral-900">Moje prijave</h2>

      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((a) => (
          <div key={a.id} className="dash-card p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-neutral-900">{a.venue}</div>
              <div className="text-sm text-neutral-500">{a.role}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{a.date}</div>
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Section: Shifts ─────────────────────────────────────────────────────── */

function ShiftsSection() {
  return (
    <>
      <h2 className="font-black text-neutral-900">Moje smene</h2>
      <div className="flex flex-col gap-3">
        {SHIFTS.map((s) => (
          <div key={s.id} className="dash-card p-5 flex items-center justify-between">
            <div>
              <div className="font-bold text-neutral-900">{s.venue}</div>
              <div className="text-sm text-neutral-500">{s.role}</div>
              <div className="text-xs text-neutral-400 mt-1">{s.date} · {s.time}</div>
            </div>
            <div className="text-right">
              <div className="font-black text-orange-500 text-sm">{s.pay}</div>
              <button className="mt-2 btn-dash-outline text-xs px-3 py-1.5">Detalji</button>
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
      <h2 className="font-black text-neutral-900">Moje recenzije</h2>
      <div className="flex flex-col gap-4">
        {REVIEWS.map((r) => (
          <div key={r.id} className="dash-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-900">{r.venue}</div>
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

/* ── Section: Passport ───────────────────────────────────────────────────── */

function PassportSection() {
  const circumference = 2 * Math.PI * 46;
  const score = 92;
  const offset = circumference - (score / 100) * circumference;

  const badges = [
    { emoji: "🧪", label: "Sanitarna knjižica", sub: "Verifikovan dokument", locked: false },
    { emoji: "🍷", label: "Somelijer", sub: "Kurs završen", locked: false },
    { emoji: "🌍", label: "Engleski B2", sub: "Jezik potvrđen", locked: false },
    { emoji: "📋", label: "Verified History", sub: "3+ verifikovane smene", locked: false },
    { emoji: "🏅", label: "Hospitality Pro", sub: "50 smena potrebno", locked: true },
    { emoji: "💎", label: "Platinum Waiter", sub: "Skor 98+ potreban", locked: true },
  ];

  return (
    <>
      <h2 className="font-black text-neutral-900">Waiter Passport™</h2>

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
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">passport skor</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">🥇 GOLD nivo</span>
            <span className="text-xs text-neutral-500 self-center">Sledeći: PLATINUM</span>
          </div>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: "84%" }} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">84% do Platinum nivoa · još 8 bodova</p>
        </div>
      </div>

      <h3 className="font-bold text-neutral-900">Bedževi</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((b) => (
          <div
            key={b.label}
            className={`dash-card p-4 flex flex-col items-center text-center gap-2 ${b.locked ? "opacity-60" : ""}`}
          >
            <span className="text-3xl">{b.emoji}</span>
            <div>
              <div className="font-bold text-neutral-900 text-sm">{b.label}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{b.sub}</div>
            </div>
            {b.locked && (
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">🔒 Zaključano</span>
            )}
          </div>
        ))}
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
    key: "alerts",
    label: "Red Alert",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    key: "jobs",
    label: "Poslovi",
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
    key: "shifts",
    label: "Smene",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
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
    key: "passport",
    label: "Passport",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: "Pregled",
  alerts: "Red Alert",
  jobs: "Dostupni poslovi",
  applications: "Moje prijave",
  shifts: "Smene",
  reviews: "Recenzije",
  passport: "Waiter Passport™",
};

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function WaiterDashboard() {
  const [section, setSection] = useState<Section>("overview");

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
        {/* Logo */}
        <div className="px-5 py-5 border-b border-neutral-100">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">
              eK
            </div>
            <span className="font-black text-neutral-900 text-base">eKonobar</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`nav-item ${section === item.key ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
              {item.key === "alerts" && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {ALERTS.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
              MN
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-900 truncate">Marko Nikolić</div>
              <div className="text-[11px] text-neutral-400 truncate">Konobar · GOLD</div>
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
        {/* Top bar */}
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
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
              MN
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
          {section === "overview" && <OverviewSection onNavigate={setSection} />}
          {section === "alerts" && <AlertsSection />}
          {section === "jobs" && <JobsSection />}
          {section === "applications" && <ApplicationsSection />}
          {section === "shifts" && <ShiftsSection />}
          {section === "reviews" && <ReviewsSection />}
          {section === "passport" && <PassportSection />}
        </div>
      </main>
    </div>
  );
}
