"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import ImageUpload from "@/components/ui/ImageUpload";

type Section = "overview" | "alerts" | "jobs" | "applications" | "shifts" | "invites" | "reviews" | "passport";
type AppFilter = "all" | "accepted" | "pending" | "rejected";

type WaiterShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  pay: number | null;
  notes: string | null;
  venue: { id: string; name: string; address: string; municipality: string };
};

const DAYS_SR   = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const MONTHS_SR = ["Januar", "Februar", "Mart", "April", "Maj", "Jun",
                   "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

/* ── API types ────────────────────────────────────────────────────────────── */

type JobPost = {
  id: string;
  title: string;
  engagementType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  redAlert: boolean;
  redAlertNote: string | null;
  status: string;
  createdAt: string;
  venue: {
    id: string;
    name: string;
    address: string;
    municipality: string;
    trustScore: number;
  };
  _count: { applications: number };
};

type InviteItem = {
  id: string;
  status: string;
  message: string | null;
  jobPostId: string | null;
  venueId: string | null;
  expiresAt: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    venues: { id: string; name: string }[];
  };
};

type RecentReview = {
  id: string;
  overallRating: number;
  comment: string;
  publishedAt: string;
  author: { name: string | null; venues: { name: string }[] };
};

type PassportData = {
  id: string;
  score: number;
  badges: string[];
  reviewCount: number;
  totalEngagements: number;
  avgEngagementMonths: number;
  skills: string[];
  languages: string[];
  yearsExperience: number;
  sanitaryBookValid: boolean;
  currentlyAvailable: boolean;
  bio: string | null;
  galleryPhotos: string[];
  venueTypePreferences: string[];
  lastAvailableDate: string | null;
  avgRedAlertResponseMinutes: number | null;
  redAlertResponseCount: number;
  recentReviews: RecentReview[];
  trustScore: {
    punctuality: number; skill: number; guestCommunication: number;
    personalHygiene: number; teamwork: number; speed: number;
    composite: number; sampleSize: number;
  } | null;
};

type MyApplication = {
  id: string;
  status: string;
  appliedAt: string;
  jobPost: {
    id: string;
    title: string;
    venue: { id: string; name: string; address: string; municipality: string };
  };
};

type WaiterReview = {
  id: string;
  direction: string;
  overallRating: number;
  comment: string | null;
  publishedAt: string | null;
  author: { id: string; name: string | null; verificationTier: string };
};

/* ── Utility ──────────────────────────────────────────────────────────────── */

const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Stalno", SEASONAL: "Sezonski", WEEKEND: "Vikend", CELEBRATION: "Slavlje",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatSalary({ salaryMin, salaryMax, engagementType }: Pick<JobPost, "salaryMin" | "salaryMax" | "engagementType">): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax) return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}

function appStatusKey(status: string): "accepted" | "pending" | "rejected" {
  if (status === "ACCEPTED" || status === "COMPLETED") return "accepted";
  if (status === "REJECTED" || status === "WITHDRAWN") return "rejected";
  return "pending";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Helper components ────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const key = appStatusKey(status);
  const cls = key === "accepted" ? "badge-accepted" : key === "pending" ? "badge-pending" : "badge-rejected";
  const labels: Record<string, string> = {
    ACCEPTED: "Prihvaćeno", COMPLETED: "Završeno", SHORTLISTED: "Shortlist",
    PENDING: "Na čekanju", REJECTED: "Odbijeno", WITHDRAWN: "Povučena",
  };
  return <span className={`${cls} text-xs font-semibold px-2.5 py-0.5 rounded-full`}>{labels[status] ?? status}</span>;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-400 text-sm">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function ApplyButton({ jobId, applied, applying, onApply }: {
  jobId: string; applied: boolean; applying: string | null; onApply: (id: string) => Promise<void>;
}) {
  if (applied) return <div className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-center">✓ Prijavljen</div>;
  return (
    <button onClick={() => onApply(jobId)} disabled={applying === jobId}
      className="btn-dash-orange px-3 py-1.5 text-xs disabled:opacity-50">
      {applying === jobId ? "..." : "Prijavi se"}
    </button>
  );
}

/* ── Tier helpers ────────────────────────────────────────────────────────── */

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  BRONZE:   { label: "BRONZE",      cls: "bg-orange-100 text-orange-700" },
  SILVER:   { label: "SILVER",      cls: "bg-neutral-200 text-neutral-600" },
  GOLD:     { label: "🥇 GOLD",     cls: "bg-amber-100 text-amber-700" },
  PLATINUM: { label: "💎 PLATINUM", cls: "bg-blue-100 text-blue-700" },
};

const NEXT_TIER: Record<string, string | null> = {
  BRONZE: "SILVER", SILVER: "GOLD", GOLD: "PLATINUM", PLATINUM: null,
};

/* ── Market Insights ─────────────────────────────────────────────────────── */

type MarketData = {
  openPositions: number;
  redAlertCount: number;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  topMunicipalities: { name: string; count: number }[];
};

function MarketInsights() {
  const [data, setData] = useState<MarketData | null>(null);

  useEffect(() => {
    fetch("/api/insights/market")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const salaryLabel = data.avgSalaryMin
    ? `${Math.round(data.avgSalaryMin / 1000)}k${data.avgSalaryMax && data.avgSalaryMax !== data.avgSalaryMin ? `–${Math.round(data.avgSalaryMax / 1000)}k` : ""} RSD`
    : null;

  return (
    <div className="dash-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-wider">Tržište — sada</h3>
      </div>
      <div className="flex gap-6 flex-wrap">
        <div className="text-center">
          <div className="text-xl font-black text-neutral-900">{data.openPositions}</div>
          <div className="text-[10px] text-neutral-400 font-medium">Otvorenih pozicija</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-orange-500">{data.redAlertCount}</div>
          <div className="text-[10px] text-neutral-400 font-medium">Red Alert</div>
        </div>
        {salaryLabel && (
          <div className="text-center">
            <div className="text-xl font-black text-neutral-900">{salaryLabel}</div>
            <div className="text-[10px] text-neutral-400 font-medium">Prosečna plata</div>
          </div>
        )}
      </div>
      {data.topMunicipalities.length > 0 && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          <span className="text-[10px] text-neutral-400 font-medium self-center">Traže:</span>
          {data.topMunicipalities.map(m => (
            <span key={m.name} className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
              {m.name} ({m.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ jobs, applications, shifts, userName, verificationTier, passport, onNavigate, onApply, applying }: {
  jobs: JobPost[]; applications: MyApplication[]; shifts: WaiterShift[];
  userName: string; verificationTier: string; passport: PassportData | null;
  onNavigate: (s: Section) => void; onApply: (id: string) => Promise<void>; applying: string | null;
}) {
  const score         = Math.round(passport?.score ?? 0);
  const circumference = 2 * Math.PI * 40;
  const offset        = circumference - (score / 100) * circumference;
  const appliedJobIds = new Set(applications.map(a => a.jobPost.id));
  const redAlerts     = jobs.filter(j => j.redAlert).slice(0, 3);
  const tier          = TIER_BADGE[verificationTier] ?? TIER_BADGE.BRONZE;
  const nextTier      = NEXT_TIER[verificationTier];
  const rating        = passport?.score ? (passport.score / 20).toFixed(1) : "—";

  return (
    <>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f0efec" strokeWidth="8" />
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f97316" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-neutral-900">{score}</span>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">skor</span>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-1">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
            {verificationTier !== "BRONZE" && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />Verifikovan
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-neutral-900">{userName}</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Konobar</p>
          <div className="flex gap-6 mt-4 justify-center sm:justify-start">
            {[
              { label: "Prijave",   value: String(applications.length) },
              { label: "Angažmani", value: String(passport?.totalEngagements ?? 0) },
              { label: "Ocena",     value: rating },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => onNavigate("passport")} className="btn-dash-orange px-4 py-2 self-start">Waiter Passport</button>
      </div>

      {redAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-4 h-4">
              <span className="pulse-ring w-4 h-4" /><span className="pulse-ring-2 w-4 h-4" />
              <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
            </div>
            <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {redAlerts.map(j => (
              <div key={j.id} className="alert-card p-4">
                <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">⚡ Hitno</div>
                <div className="font-bold text-neutral-900 text-sm">{j.venue.name}</div>
                <div className="text-xs text-neutral-600 mt-0.5">{j.title}</div>
                <div className="text-xs text-neutral-500 mt-1">{ENGAGEMENT_LABELS[j.engagementType] ?? j.engagementType}</div>
                <div className="text-sm font-black text-orange-600 mt-2">{formatSalary(j)}</div>
                <div className="mt-2"><ApplyButton jobId={j.id} applied={appliedJobIds.has(j.id)} applying={applying} onApply={onApply} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <MarketInsights />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Predstojeće smene</h3>
            <button onClick={() => onNavigate("shifts")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          <div className="flex flex-col gap-2">
            {shifts.length === 0
              ? <p className="text-sm text-neutral-400 text-center py-4">Nema predstojećih smena</p>
              : shifts
                  .filter(s => new Date(s.date) >= new Date(new Date().toDateString()))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 3)
                  .map(s => {
                    const dateStr = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
                    return (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                        <div>
                          <div className="text-sm font-semibold text-neutral-800">{s.venue.name}</div>
                          <div className="text-xs text-neutral-400 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                        </div>
                        {s.pay && <span className="text-sm font-bold text-orange-500">{s.pay.toLocaleString("sr-RS")} RSD</span>}
                      </div>
                    );
                  })
            }
          </div>
        </div>

        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Moje prijave</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          {applications.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Još nema prijava</p>
            : <div className="flex flex-col gap-2">
                {applications.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-neutral-800">{a.jobPost.venue.name}</div>
                      <div className="text-xs text-neutral-400">{a.jobPost.title}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-neutral-900 text-sm">Waiter Passport™ napredak</h3>
            <p className="text-xs text-neutral-400">
              {nextTier ? `Do ${nextTier} nivoa: još ${100 - score} bodova` : "Maksimalni nivo dostignut"}
            </p>
          </div>
          <span className="text-orange-500 font-black text-lg">{score}%</span>
        </div>
        <div className="prog-track"><div className="prog-fill" style={{ width: `${score}%` }} /></div>
        <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
          <span>SILVER</span><span>GOLD</span><span>PLATINUM</span>
        </div>
      </div>
    </>
  );
}

/* ── Section: Alerts ─────────────────────────────────────────────────────── */

function AlertsSection({ jobs, loading, onApply, applying, appliedJobIds }: {
  jobs: JobPost[]; loading: boolean; onApply: (id: string) => Promise<void>;
  applying: string | null; appliedJobIds: Set<string>;
}) {
  if (loading) return <Spinner />;
  const alerts = jobs.filter(j => j.redAlert);
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative w-4 h-4">
          <span className="pulse-ring w-4 h-4" /><span className="pulse-ring-2 w-4 h-4" />
          <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        </div>
        <h2 className="font-black text-neutral-900 text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h2>
      </div>
      <p className="text-xs text-neutral-400 -mt-3">Ovi angažmani zahtevaju brzu odluku.</p>
      {alerts.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema hitnih angažmana trenutno</div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map(j => (
              <div key={j.id} className="alert-card p-5">
                <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">⚡ Hitno</div>
                <div className="font-bold text-neutral-900">{j.venue.name}</div>
                <div className="text-sm text-neutral-600 mt-0.5">{j.title}</div>
                <div className="text-xs text-neutral-500 mt-1">{j.venue.municipality}</div>
                <div className="text-lg font-black text-orange-600 mt-3">{formatSalary(j)}</div>
                {j.redAlertNote && <p className="text-xs text-orange-700 mt-1">{j.redAlertNote}</p>}
                <div className="mt-3"><ApplyButton jobId={j.id} applied={appliedJobIds.has(j.id)} applying={applying} onApply={onApply} /></div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Jobs ───────────────────────────────────────────────────────── */

function JobsSection({ jobs, loading, onApply, applying, appliedJobIds }: {
  jobs: JobPost[]; loading: boolean; onApply: (id: string) => Promise<void>;
  applying: string | null; appliedJobIds: Set<string>;
}) {
  if (loading) return <Spinner />;
  return (
    <>
      <h2 className="font-black text-neutral-900">Dostupni poslovi</h2>
      {jobs.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema dostupnih oglasa</div>
        : <div className="flex flex-col gap-3">
            {jobs.map(j => (
              <div key={j.id} className="dash-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-orange-50 rounded-xl flex-shrink-0 text-xl font-black text-orange-400">
                  {j.venue.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-neutral-900">{j.venue.name}</span>
                    {j.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">⚡ RED</span>}
                  </div>
                  <div className="text-sm text-neutral-500">{j.title}</div>
                  <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                    <span>{ENGAGEMENT_LABELS[j.engagementType] ?? j.engagementType}</span>
                    <span>·</span>
                    <span>{j.venue.municipality}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-orange-500 mb-2">{formatSalary(j)}</div>
                  <ApplyButton jobId={j.id} applied={appliedJobIds.has(j.id)} applying={applying} onApply={onApply} />
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

function ApplicationsSection({ applications, loading }: { applications: MyApplication[]; loading: boolean }) {
  const [filter, setFilter] = useState<AppFilter>("all");
  if (loading) return <Spinner />;
  const filtered = filter === "all" ? applications : applications.filter(a => appStatusKey(a.status) === filter);
  const tabs: { key: AppFilter; label: string }[] = [
    { key: "all", label: "Sve" }, { key: "accepted", label: "Prihvaćene" },
    { key: "pending", label: "Na čekanju" }, { key: "rejected", label: "Odbijene" },
  ];
  return (
    <>
      <h2 className="font-black text-neutral-900">Moje prijave</h2>
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema prijava</div>
        : <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <div key={a.id} className="dash-card p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-neutral-900">{a.jobPost.venue.name}</div>
                  <div className="text-sm text-neutral-500">{a.jobPost.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{formatDate(a.appliedAt)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Shifts (waiter calendar) ───────────────────────────────────── */

function ShiftsSection({ shifts, loading }: { shifts: WaiterShift[]; loading: boolean }) {
  const now = new Date();
  const [current, setCurrent]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<WaiterShift | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const year  = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayNum    = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const shiftsByDay: Record<number, WaiterShift[]> = {};
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

  return (
    <>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-neutral-900">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-neutral-400 font-medium mb-0.5">Lokal</div>
                <div className="text-sm font-bold text-neutral-900">{selected.venue.name}</div>
                <div className="text-xs text-neutral-400">{selected.venue.address}, {selected.venue.municipality}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Datum</div>
                  <div className="text-sm font-semibold text-neutral-900 capitalize">
                    {new Date(selected.date).toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Vreme</div>
                  <div className="text-sm font-semibold text-neutral-900">{selected.startTime} – {selected.endTime}</div>
                </div>
              </div>
              {selected.role && (
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Uloga</div>
                  <div className="text-sm font-semibold text-neutral-900">{selected.role}</div>
                </div>
              )}
              {selected.pay != null && (
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Naknada</div>
                  <div className="text-lg font-black text-orange-500">{selected.pay.toLocaleString("sr-RS")} RSD</div>
                </div>
              )}
              {selected.notes && (
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Napomena</div>
                  <div className="text-sm text-neutral-600 leading-relaxed">{selected.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="font-black text-neutral-900">Moje smene</h2>

      {/* Calendar */}
      <div className="dash-card overflow-hidden">
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
        <div className="grid grid-cols-7 border-b border-neutral-100">
          {DAYS_SR.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-neutral-400 py-2.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum      = i - firstDay + 1;
            const isValid     = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday     = dayNum === todayNum;
            const isLastInRow = (i + 1) % 7 === 0;
            const isLastRow   = i >= totalCells - 7;
            const dayShifts   = isValid ? (shiftsByDay[dayNum] ?? []) : [];
            return (
              <div key={i}
                className={[
                  "min-h-[84px] p-1.5",
                  !isLastInRow && "border-r border-neutral-100",
                  !isLastRow   && "border-b border-neutral-100",
                  !isValid     && "bg-neutral-50/40",
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
                          <div onClick={() => setSelected(s)}
                            className="text-[10px] font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-orange-200 transition-colors">
                            {s.startTime} {s.venue.name}
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

      {/* Upcoming list */}
      {shifts.length === 0 ? (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nemaš dodeljenih smena</div>
      ) : upcoming.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-3">Nadolazeće smene</h3>
          <div className="flex flex-col gap-0">
            {upcoming.map(s => {
              const dateStr = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={s.id} onClick={() => setSelected(s)}
                  className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0 cursor-pointer hover:opacity-75 transition-opacity">
                  <div>
                    <div className="text-sm font-semibold text-neutral-800">{s.venue.name}</div>
                    <div className="text-xs text-neutral-400 mt-0.5 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                  </div>
                  {s.pay != null && <div className="font-black text-orange-500 text-sm flex-shrink-0 ml-4">{s.pay.toLocaleString("sr-RS")} RSD</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

const DIRECTION_LABELS: Record<string, string> = {
  VENUE_TO_WAITER: "Lokal",
  GUEST_TO_WAITER: "Gost",
};

function ReviewsSection() {
  const { data: session } = useSession();
  const [reviews, setReviews]   = useState<WaiterReview[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/reviews?subjectId=${session.user.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(setReviews)
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  if (loading) return <Spinner />;

  return (
    <>
      <h2 className="font-black text-neutral-900">Moje recenzije</h2>
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

/* ── TagInput ────────────────────────────────────────────────────────────── */

function TagInput({ tags, onChange, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = (val: string) => {
    const v = val.trim().toLowerCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  const remove = (tag: string) => onChange(tags.filter(t => t !== tag));
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && input === "" && tags.length > 0) remove(tags[tags.length - 1]);
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-neutral-200 rounded-xl min-h-[42px] focus-within:border-orange-400 transition-colors cursor-text">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => remove(t)} className="hover:text-orange-900 leading-none font-bold">&times;</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
        onBlur={() => { if (input) add(input); }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent" />
    </div>
  );
}

/* ── Passport constants ───────────────────────────────────────────────────── */

const BADGE_META: Record<string, { emoji: string; label: string; sub: string }> = {
  sanitarna:        { emoji: "🧪", label: "Sanitarna knjižica", sub: "Verifikovan dokument" },
  sommelier:        { emoji: "🍷", label: "Somelijer",           sub: "Kurs završen" },
  english_b2:       { emoji: "🌍", label: "Engleski B2",         sub: "Jezik potvrđen" },
  verified_history: { emoji: "📋", label: "Verified History",    sub: "3+ verifikovane smene" },
  hospitality_pro:  { emoji: "🏅", label: "Hospitality Pro",     sub: "50 smena potrebno" },
  platinum:         { emoji: "💎", label: "Platinum Waiter",     sub: "Skor 98+ potreban" },
};

const BADGE_PROGRESS: Record<string, ((p: PassportData) => { current: number; total: number; unit: string }) | null> = {
  verified_history: (p) => ({ current: Math.min(p.totalEngagements, 3),  total: 3,  unit: "smena" }),
  hospitality_pro:  (p) => ({ current: Math.min(p.totalEngagements, 50), total: 50, unit: "smena" }),
  platinum:         (p) => ({ current: Math.min(Math.round(p.score), 98), total: 98, unit: "skor" }),
  sanitarna:        null,
  sommelier:        null,
  english_b2:       null,
};

const VENUE_TYPE_OPTIONS = [
  { value: "RESTAURANT", label: "Restoran" },
  { value: "CAFE",       label: "Kafić" },
  { value: "BAR",        label: "Bar" },
  { value: "NIGHT_CLUB", label: "Noćni klub" },
  { value: "HOTEL",      label: "Hotel" },
  { value: "CATERING",   label: "Ketering" },
];

const SCORE_DIMS: { key: keyof NonNullable<PassportData["trustScore"]>; label: string }[] = [
  { key: "punctuality",         label: "Tačnost" },
  { key: "skill",               label: "Veštine" },
  { key: "guestCommunication",  label: "Komunikacija" },
  { key: "personalHygiene",     label: "Higijena" },
  { key: "teamwork",            label: "Tim" },
  { key: "speed",               label: "Brzina" },
];

/* ── Section: Passport ───────────────────────────────────────────────────── */

function PassportSection({ userName }: { userName: string }) {
  const [passport, setPassport]   = useState<PassportData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const [bio, setBio]                             = useState("");
  const [skills, setSkills]                       = useState<string[]>([]);
  const [languages, setLanguages]                 = useState<string[]>([]);
  const [yearsExperience, setYears]               = useState(0);
  const [currentlyAvailable, setAvailable]        = useState(true);
  const [venueTypePreferences, setVenuePrefs]     = useState<string[]>([]);
  const [galleryPhotos, setGalleryPhotos]         = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/passport")
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setPassport(data);
          setBio(data.bio ?? "");
          setSkills(data.skills ?? []);
          setLanguages(data.languages ?? []);
          setYears(data.yearsExperience ?? 0);
          setAvailable(data.currentlyAvailable ?? true);
          setVenuePrefs(data.venueTypePreferences ?? []);
          setGalleryPhotos(data.galleryPhotos ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/passport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: bio || null, skills, languages, yearsExperience, currentlyAvailable, venueTypePreferences }),
    });
    if (res.ok) {
      const data = await res.json();
      setPassport(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-7 w-52 bg-neutral-200 rounded-lg" />
      <div className="dash-card p-6 flex gap-6 items-center">
        <div className="w-28 h-28 rounded-full bg-neutral-200 flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-5 w-36 bg-neutral-200 rounded" />
          <div className="h-4 w-24 bg-neutral-200 rounded" />
          <div className="h-4 w-full bg-neutral-200 rounded mt-1" />
          <div className="h-4 w-3/4 bg-neutral-200 rounded" />
        </div>
      </div>
      <div className="dash-card p-5 h-32 bg-neutral-100 rounded-2xl" />
      <div className="dash-card p-5 h-48 bg-neutral-100 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dash-card p-4 h-28 bg-neutral-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );

  const score         = passport?.score ?? 0;
  const circumference = 2 * Math.PI * 46;
  const offset        = circumference - (score / 100) * circumference;
  const earnedBadges  = passport?.badges ?? [];

  return (
    <>
      <h2 className="font-black text-neutral-900">Waiter Passport™</h2>

      {/* Score card */}
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f0efec" strokeWidth="10" />
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f97316" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-neutral-900">{Math.round(score)}</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">skor</span>
          </div>
          <div className="group absolute -top-1 -right-1 z-10">
            <div className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold flex items-center justify-center cursor-help select-none">ℹ</div>
            <div className="absolute bottom-full right-0 mb-1.5 w-52 bg-neutral-900 text-white text-[10px] rounded-xl p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed shadow-lg">
              Skor raste verifikovanjem smena i pozitivnim recenzijama vlasnika i gostiju. Brzi odgovor na Red Alert povećava vidljivost na listi vlasnika.
              <div className="absolute top-full right-3 border-4 border-transparent border-t-neutral-900" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-neutral-900 text-lg">{userName}</div>
          <div className="flex gap-2 flex-wrap mt-1.5">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${currentlyAvailable ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
              {currentlyAvailable ? "Dostupan" : "Zauzet"}
            </span>
            {currentlyAvailable && passport?.lastAvailableDate && (() => {
              const days = Math.floor((Date.now() - new Date(passport.lastAvailableDate).getTime()) / 86_400_000) + 1;
              return days >= 2 ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-500">🔥 {days}d streak</span>
              ) : null;
            })()}
            {passport?.sanitaryBookValid && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">Sanitarna ✓</span>
            )}
          </div>
          {bio && <p className="text-sm text-neutral-500 mt-2 leading-relaxed line-clamp-2">{bio}</p>}
          <div className="flex gap-5 mt-3">
            {[
              { label: "Recenzije",     val: passport?.reviewCount ?? 0 },
              { label: "Angažmani",     val: passport?.totalEngagements ?? 0 },
              { label: "God. iskustva", val: yearsExperience },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{s.val}</div>
                <div className="text-[10px] text-neutral-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
          {passport?.avgRedAlertResponseMinutes != null && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold bg-orange-50 text-orange-600 px-3 py-1 rounded-full">
              ⚡ Prosečan odgovor:{" "}
              {passport.avgRedAlertResponseMinutes < 60
                ? `${passport.avgRedAlertResponseMinutes}min`
                : `${Math.round(passport.avgRedAlertResponseMinutes / 60)}h`}
              {" "}· {passport.redAlertResponseCount} Red Alert{passport.redAlertResponseCount !== 1 ? "a" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Trust score breakdown — only if there are reviews */}
      {passport?.trustScore && passport.trustScore.sampleSize > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-4">Dimenzije skora</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SCORE_DIMS.map(({ key, label }) => {
              const val = Math.round((passport.trustScore as NonNullable<PassportData["trustScore"]>)[key]);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-500">{label}</span>
                    <span className="font-bold text-neutral-800">{val}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-3">Na osnovu {passport.trustScore.sampleSize} recenzija</p>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="dash-card p-5 flex flex-col gap-5">
        <h3 className="font-bold text-neutral-900">Uredi profil</h3>

        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">Dostupan za angažman</div>
            <div className="text-xs text-neutral-400 mt-0.5">Vidljivo vlasnicima lokala</div>
          </div>
          <button type="button" onClick={() => setAvailable(p => !p)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${currentlyAvailable ? "bg-green-500" : "bg-neutral-200"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${currentlyAvailable ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Godine iskustva</label>
          <input type="number" min={0} max={50} value={yearsExperience}
            onChange={e => setYears(Number(e.target.value))}
            className="auth-input w-28" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            placeholder="Kratko predstavljanje — šta te čini dobrim konobarom?"
            className="auth-input resize-none" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Veštine</label>
          <TagInput tags={skills} onChange={setSkills} placeholder="fine dining, cocktails... (Enter za dodavanje)" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Jezici</label>
          <TagInput tags={languages} onChange={setLanguages} placeholder="srpski, engleski... (Enter za dodavanje)" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-2 block">Tip objekta (preferencije)</label>
          <div className="flex flex-wrap gap-2">
            {VENUE_TYPE_OPTIONS.map(opt => {
              const active = venueTypePreferences.includes(opt.value);
              return (
                <button key={opt.value} type="button"
                  onClick={() => setVenuePrefs(p => active ? p.filter(v => v !== opt.value) : [...p, opt.value])}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-500 border-neutral-200 hover:border-orange-300"}`}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">Algoritam šalje Red Alert samo za odabrane tipove.</p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-dash-orange px-6 py-2.5 disabled:opacity-50">
            {saving ? "Čuvanje..." : "Sačuvaj profil"}
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">✓ Sačuvano</span>}
        </div>
      </form>

      {/* Gallery */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-neutral-900">Galerija &ldquo;U radu&rdquo;</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Do 4 fotografije — uniforma, koktel, servis. Vizuelni dokaz iskustva.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ImageUpload key={i} current={galleryPhotos[i]} uploadType="venue-photo" shape="rect" label=""
              onUpload={async (url) => {
                const updated = [...galleryPhotos];
                updated[i] = url;
                setGalleryPhotos(updated);
                await fetch("/api/passport", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ galleryPhotos: updated }),
                });
              }} />
          ))}
        </div>
      </div>

      {/* Top endorsements */}
      {passport?.recentReviews && passport.recentReviews.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-4">Poslednje recenzije vlasnika</h3>
          <div className="flex flex-col gap-4">
            {passport.recentReviews.map(r => (
              <div key={r.id} className="flex gap-3">
                <span className="text-orange-300 text-2xl leading-none font-serif">&ldquo;</span>
                <div className="flex-1">
                  <p className="text-sm text-neutral-700 italic leading-relaxed">{r.comment}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-xs ${i < Math.round(r.overallRating / 20) ? "text-orange-400" : "text-neutral-200"}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                      {r.author.venues[0]?.name ?? r.author.name ?? "Vlasnik"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <h3 className="font-bold text-neutral-900">Bedževi</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(BADGE_META).map(([key, meta]) => {
          const earned = earnedBadges.includes(key);
          const progressFn = BADGE_PROGRESS[key];
          const progress = !earned && passport && progressFn ? progressFn(passport) : null;
          return (
            <div key={key} className={`dash-card p-4 flex flex-col items-center text-center gap-2 transition-opacity ${!earned ? "opacity-60" : ""}`}>
              <span className="text-3xl">{meta.emoji}</span>
              <div>
                <div className="font-bold text-neutral-900 text-sm">{meta.label}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{meta.sub}</div>
              </div>
              {earned && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">✓ Otključano</span>}
              {!earned && progress && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                    <span>{progress.current}/{progress.total} {progress.unit}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full transition-all"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                  </div>
                </div>
              )}
              {!earned && !progress && (
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">🔒 Zahteva verifikaciju</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Section: Invites ────────────────────────────────────────────────────── */

function InvitesSection({ invites, loading, onRespond }: {
  invites: InviteItem[]; loading: boolean;
  onRespond: (id: string, status: "ACCEPTED" | "DECLINED") => Promise<void>;
}) {
  const [responding, setResponding] = useState<string | null>(null);

  const handle = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setResponding(id);
    await onRespond(id, status);
    setResponding(null);
  };

  if (loading) return <Spinner />;

  const pending = invites.filter(i => i.status === "PENDING");
  const past    = invites.filter(i => i.status !== "PENDING");

  const venueName = (inv: InviteItem) => inv.sender.venues[0]?.name ?? inv.sender.name ?? "Lokal";

  return (
    <>
      <h2 className="font-black text-neutral-900">Pozivnice</h2>
      {pending.length === 0 && past.length === 0 && (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema pozivnica</div>
      )}
      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-neutral-600">Na čekanju</h3>
          {pending.map(inv => (
            <div key={inv.id} className="dash-card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                  {getInitials(venueName(inv))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-900">{venueName(inv)}</div>
                  {inv.message && (
                    <p className="text-sm text-neutral-500 mt-1 leading-relaxed italic">&ldquo;{inv.message}&rdquo;</p>
                  )}
                  <div className="text-xs text-neutral-400 mt-1">{formatDate(inv.createdAt)}</div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => handle(inv.id, "ACCEPTED")} disabled={responding === inv.id}
                    className="btn-dash-orange px-3 py-1.5 text-[11px] disabled:opacity-50">
                    {responding === inv.id ? "..." : "Prihvati"}
                  </button>
                  <button onClick={() => handle(inv.id, "DECLINED")} disabled={responding === inv.id}
                    className="btn-dash-outline px-3 py-1.5 text-[11px] disabled:opacity-50">
                    Odbij
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-neutral-600">Istorija</h3>
          {past.map(inv => (
            <div key={inv.id} className="dash-card p-5 opacity-70">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold flex-shrink-0">
                  {getInitials(venueName(inv))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-700">{venueName(inv)}</div>
                  <div className="text-xs text-neutral-400 mt-1">{formatDate(inv.createdAt)}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inv.status === "ACCEPTED" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
                  {inv.status === "ACCEPTED" ? "Prihvaćena" : "Odbijena"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview",     label: "Pregled",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "alerts",       label: "Red Alert", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> },
  { key: "jobs",         label: "Poslovi",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { key: "applications", label: "Prijave",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg> },
  { key: "shifts",       label: "Smene",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "invites",      label: "Pozivnice", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  { key: "reviews",      label: "Recenzije", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
  { key: "passport",     label: "Passport",  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: "Pregled", alerts: "Red Alert", jobs: "Dostupni poslovi",
  applications: "Moje prijave", shifts: "Smene", invites: "Pozivnice",
  reviews: "Recenzije", passport: "Waiter Passport™",
};

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function WaiterDashboard() {
  const { data: session } = useSession();
  const [section, setSection]           = useState<Section>("overview");
  const [jobs, setJobs]                 = useState<JobPost[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [applying, setApplying]         = useState<string | null>(null);
  const [shifts, setShifts]             = useState<WaiterShift[]>([]);
  const [invites, setInvites]           = useState<InviteItem[]>([]);
  const [passport, setPassport]         = useState<PassportData | null>(null);
  const [mobileOpen, setMobileOpen]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [jobsRes, appsRes, shiftsRes, invitesRes, passportRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/jobs/applications"),
      fetch("/api/shifts"),
      fetch("/api/invites"),
      fetch("/api/passport"),
    ]);
    if (jobsRes.ok)     setJobs(await jobsRes.json());
    if (appsRes.ok)     setApplications(await appsRes.json());
    if (shiftsRes.ok)   setShifts(await shiftsRes.json());
    if (invitesRes.ok)  setInvites(await invitesRes.json());
    if (passportRes.ok) { const p = await passportRes.json(); if (p?.id) setPassport(p); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApply = async (jobPostId: string) => {
    setApplying(jobPostId);
    const res = await fetch("/api/jobs/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPostId }),
    });
    if (res.ok) await fetchData();
    setApplying(null);
  };

  const handleInviteRespond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    await fetch(`/api/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const userName      = session?.user?.name ?? "Konobar";
  const initials      = getInitials(session?.user?.name);
  const appliedJobIds = new Set(applications.map(a => a.jobPost.id));
  const alertCount    = jobs.filter(j => j.redAlert).length;
  const inviteCount   = invites.filter(i => i.status === "PENDING").length;
  const today = new Date().toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const navContent = (closeMenu?: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{item.label}
            {item.key === "alerts" && alertCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{alertCount}</span>
            )}
            {item.key === "invites" && inviteCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{inviteCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-neutral-900 truncate">{userName}</div>
            <div className="text-[11px] text-neutral-400 truncate">Konobar · GOLD</div>
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
              {alertCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />}
            </button>
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">{initials}</div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
          {section === "overview"     && <OverviewSection jobs={jobs} applications={applications} shifts={shifts} userName={userName} verificationTier={session?.user?.verificationTier ?? "BRONZE"} passport={passport} onNavigate={setSection} onApply={handleApply} applying={applying} />}
          {section === "alerts"       && <AlertsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
          {section === "jobs"         && <JobsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
          {section === "applications" && <ApplicationsSection applications={applications} loading={loading} />}
          {section === "shifts"       && <ShiftsSection shifts={shifts} loading={loading} />}
          {section === "invites"      && <InvitesSection invites={invites} loading={loading} onRespond={handleInviteRespond} />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "passport"     && <PassportSection userName={userName} />}
        </div>
      </main>
    </div>
  );
}
