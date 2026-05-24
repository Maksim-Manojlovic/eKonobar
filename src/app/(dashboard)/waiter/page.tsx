"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationsSection } from "@/components/ui/NotificationsSection";
import DashboardShell from "@/components/layout/DashboardShell";
import type { Section, AppFilter, JobPost, MyApplication, WaiterShift, InviteItem, PassportData, WaiterReview, ManagedShift } from "./waiter-types";
import { TIER_BADGE, NEXT_TIER, DIRECTION_LABELS, getInitials, formatSalary, appStatusKey, formatDate, SECTION_TITLES } from "./waiter-types";
import { ENGAGEMENT_LABELS } from "@/lib/display-maps";
import { Sk, Stars, StatusBadge, ApplyButton, MarketInsights, OverviewSkeleton, AlertsSkeleton, JobsSkeleton, WaiterApplicationsSkeleton, InvitesSkeleton, NAV_ITEMS } from "./waiter-helpers";
import { ShiftsSection, HeadWaiterSmeneSection } from "./WaiterSmeneSection";
import PassportSection from "./WaiterPassportSection";
/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ jobs, applications, shifts, userName, verificationTier, passport, onNavigate, onApply, applying, loading }: {
  jobs: JobPost[]; applications: MyApplication[]; shifts: WaiterShift[];
  userName: string; verificationTier: string; passport: PassportData | null;
  onNavigate: (s: Section) => void; onApply: (id: string) => Promise<void>; applying: string | null;
  loading: boolean;
}) {
  if (loading) return <OverviewSkeleton />;
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
                  .filter(s => new Date(s.scheduledStart ?? s.date) >= new Date(new Date().toDateString()))
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
  if (loading) return <AlertsSkeleton />;
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
        <h2 className="font-black text-white text-sm uppercase tracking-wider">Red Alert — Hitni Angažmani</h2>
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
  if (loading) return <JobsSkeleton />;
  return (
    <>
      <h2 className="font-black text-white">Dostupni poslovi</h2>
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
  if (loading) return <WaiterApplicationsSkeleton />;
  const filtered = filter === "all" ? applications : applications.filter(a => appStatusKey(a.status) === filter);
  const tabs: { key: AppFilter; label: string }[] = [
    { key: "all", label: "Sve" }, { key: "accepted", label: "Prihvaćene" },
    { key: "pending", label: "Na čekanju" }, { key: "rejected", label: "Odbijene" },
  ];
  return (
    <>
      <h2 className="font-black text-white">Moje prijave</h2>
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

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <Sk className="h-7 w-44" />
      {[0,1,2].map(i => <Sk key={i} className="h-24 w-full" />)}
    </div>
  );

  return (
    <>
      <h2 className="font-black text-white">Moje recenzije</h2>
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

  if (loading) return <InvitesSkeleton />;

  const pending = invites.filter(i => i.status === "PENDING");
  const past    = invites.filter(i => i.status !== "PENDING");

  const venueName = (inv: InviteItem) => inv.sender.venues[0]?.name ?? inv.sender.name ?? "Lokal";

  return (
    <>
      <h2 className="font-black text-white">Pozivnice</h2>
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


/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function WaiterDashboard() {
  const { data: session } = useSession();
  const [section, setSection]           = useState<Section>("overview");
  const [paymentToast, setPaymentToast] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" || payment === "cancelled") {
      setPaymentToast(payment);
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);
      if (payment === "success") setSection("passport");
      setTimeout(() => setPaymentToast(null), 5000);
    }
  }, []);
  const [jobs, setJobs]                 = useState<JobPost[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [applying, setApplying]         = useState<string | null>(null);
  const [shifts, setShifts]             = useState<WaiterShift[]>([]);
  const [invites, setInvites]           = useState<InviteItem[]>([]);
  const [passport, setPassport]         = useState<PassportData | null>(null);
  const [notifUnread, setNotifUnread]   = useState(0);
  const [managedVenue, setManagedVenue] = useState<{ id: string; name: string } | null>(null);
  const [managedShifts, setManagedShifts] = useState<ManagedShift[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [jobsRes, appsRes, shiftsRes, invitesRes, passportRes, manageRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/jobs/applications"),
      fetch("/api/shifts"),
      fetch("/api/invites"),
      fetch("/api/passport"),
      fetch("/api/shifts?view=manage"),
    ]);
    if (jobsRes.ok)     setJobs(await jobsRes.json());
    if (appsRes.ok)     setApplications(await appsRes.json());
    if (shiftsRes.ok)   setShifts(await shiftsRes.json());
    if (invitesRes.ok)  setInvites(await invitesRes.json());
    if (passportRes.ok) { const p = await passportRes.json(); if (p?.id) setPassport(p); }
    if (manageRes.ok) {
      const m = await manageRes.json();
      if (m?.venue) { setManagedVenue(m.venue); setManagedShifts(m.shifts ?? []); }
    }
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
            {item.key === "notifications" && notifUnread > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{notifUnread > 9 ? "9+" : notifUnread}</span>
            )}
          </button>
        ))}
        {managedVenue && (
          <button
            onClick={() => { setSection("manage"); closeMenu?.(); }}
            className={`nav-item ${section === "manage" ? "active" : ""}`}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Šef konobara
            <span className="ml-auto text-[9px] bg-orange-500/20 text-orange-300 font-bold px-1.5 py-0.5 rounded-full border border-orange-500/30">ŠEFOV</span>
          </button>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0 border border-orange-500/30">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{userName}</div>
            <div className="text-[11px] text-white/40 truncate">Konobar</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-item text-red-400/80 hover:bg-red-900/20 hover:text-red-300 w-full">
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
      {/* Payment toast — rendered outside shell to stay above everything */}
      {paymentToast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${paymentToast === "success" ? "bg-green-600 text-white" : "bg-neutral-700 text-white"}`}>
          {paymentToast === "success" ? (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Passport Pro aktiviran! Pretplata je uspešno pokrenuta.</>
          ) : (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Plaćanje otkazano.</>
          )}
        </div>
      )}

      <DashboardShell
        sectionTitle={SECTION_TITLES[section]}
        today={today}
        navContent={navContent}
        topRight={
          <>
            <NotificationBell
              dashboardPath="/dashboard/waiter"
              onViewAll={() => setSection("notifications")}
              onUnreadChange={setNotifUnread}
            />
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-300 font-bold text-sm border border-orange-500/30">
              {initials}
            </div>
          </>
        }
      >
        {section === "overview"      && <OverviewSection jobs={jobs} applications={applications} shifts={shifts} userName={userName} verificationTier={session?.user?.verificationTier ?? "BRONZE"} passport={passport} onNavigate={setSection} onApply={handleApply} applying={applying} loading={loading} />}
        {section === "alerts"        && <AlertsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
        {section === "jobs"          && <JobsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
        {section === "applications"  && <ApplicationsSection applications={applications} loading={loading} />}
        {section === "shifts"        && <ShiftsSection shifts={shifts} loading={loading} onRefresh={fetchData} />}
        {section === "invites"       && <InvitesSection invites={invites} loading={loading} onRespond={handleInviteRespond} />}
        {section === "reviews"       && <ReviewsSection />}
        {section === "passport"      && <PassportSection userName={userName} />}
        {section === "manage"        && managedVenue && <HeadWaiterSmeneSection venue={managedVenue} shifts={managedShifts} loading={loading} onRefresh={fetchData} />}
        {section === "notifications" && <NotificationsSection />}
      </DashboardShell>
    </>
  );
}