"use client";

import type { Section, JobPost, MyApplication, WaiterShift, PassportData } from "./waiter-types";
import { TIER_BADGE, NEXT_TIER } from "./waiter-constants";
import { ENGAGEMENT_LABELS } from "@/lib/display-maps";
import { formatSalary } from "@/lib/format-utils";
import { ApplyButton, MarketInsights, OverviewSkeleton, StatusBadge } from "./waiter-helpers";

export function OverviewSection({ jobs, applications, shifts, userName, verificationTier, passport, onNavigate, onApply, applying, loading }: {
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
