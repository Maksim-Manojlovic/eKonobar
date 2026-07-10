"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { getInitials } from "@/lib/formatting/utils";
import { ANALYTICS_PERIODS, FLAG_STYLES } from "./venue-constants";
import { AnalyticsSkeleton } from "./venue-helpers";
import type { Venue, WaiterAnalytics, WaiterReliability, WaiterFlag, GuestRating } from "./venue-types";

/* ── Trend arrow ─────────────────────────────────────────────────────────── */

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={`text-[11px] font-bold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"}{Math.abs(delta)}
    </span>
  );
}

/* ── Guest rating ────────────────────────────────────────────────────────── */

/** 0–100 → 1-decimal star value. */
const toStars = (v: number) => (v / 20).toFixed(1);

function GuestDimBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-neutral-500">{label}</span>
        <span className="font-bold text-neutral-700">{value !== null ? `${toStars(value)}★` : "—"}</span>
      </div>
      <div className="prog-track"><div className="prog-fill" style={{ width: `${value ?? 0}%` }} /></div>
    </div>
  );
}

function GuestBlock({ g }: { g: GuestRating }) {
  return (
    <div className="mt-3 pt-3 border-t border-neutral-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-neutral-700">Gosti</span>
        <span className="text-xs text-neutral-500">
          <span className="font-black text-amber-500">{toStars(g.overall)}★</span> · {g.count} recenzij{g.count === 1 ? "a" : "a"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <GuestDimBar label="Ljubaznost"  value={g.friendliness} />
        <GuestDimBar label="Brzina"      value={g.guestSpeed} />
        <GuestDimBar label="Pažljivost"  value={g.attentiveness} />
      </div>
    </div>
  );
}

/* ── Reliability pill ────────────────────────────────────────────────────── */

function reliabilityColor(score: number): string {
  if (score >= 85) return "bg-green-100 text-green-700";
  if (score >= 65) return "bg-lime-100 text-lime-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function ReliabilityPill({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center justify-center w-14 h-12 rounded-xl bg-neutral-100 text-neutral-400 flex-shrink-0">
        <span className="text-sm font-black">—</span>
        <span className="text-[8px] font-bold uppercase tracking-wide">malo</span>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl flex-shrink-0 ${reliabilityColor(score)}`}>
      <span className="text-lg font-black leading-none">{score}</span>
      <span className="text-[8px] font-bold uppercase tracking-wide">pouzdan</span>
    </div>
  );
}

/* ── Team stat tiles ─────────────────────────────────────────────────────── */

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="dash-card p-4">
      <div className="text-xs text-neutral-400 font-medium">{label}</div>
      <div className="text-2xl font-black text-neutral-900 mt-1">{value}</div>
      {hint && <div className="text-[11px] text-neutral-400 mt-0.5">{hint}</div>}
    </div>
  );
}

/* ── Red-flags strip ─────────────────────────────────────────────────────── */

function FlagsStrip({ flags }: { flags: WaiterFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="dash-card p-4 flex items-center gap-2 text-sm text-green-700">
        <span>✓</span> Nema upozorenja — tim je uredan.
      </div>
    );
  }
  return (
    <div className="dash-card p-4">
      <h3 className="font-bold text-neutral-900 text-sm mb-3">Upozorenja ({flags.length})</h3>
      <div className="flex flex-col gap-2">
        {flags.map((f, i) => {
          const style = FLAG_STYLES[f.kind] ?? { label: f.kind, cls: "bg-neutral-100 text-neutral-600" };
          return (
            <div key={`${f.waiterId}-${f.kind}-${i}`} className="flex items-center gap-2 text-sm">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.cls}`}>{style.label}</span>
              <span className="font-semibold text-neutral-800">{f.name ?? "Konobar"}</span>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-500">{f.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Activity sparkline (single-series, brand hue, no axes) ──────────────── */

function Sparkline({ series }: { series: number[] }) {
  const w = 120, h = 28, pad = 2;
  const max = Math.max(1, ...series);
  const n = series.length;
  const stepX = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = series.map((v, i) => `${pad + i * stepX},${y(v)}`);
  const line = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
  const area = `${line} L${pad + (n - 1) * stepX},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <path d={area} fill="#f97316" fillOpacity={0.1} />
      <path d={line} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Leaderboard ─────────────────────────────────────────────────────────── */

function LeaderRow({ w, rank }: { w: WaiterReliability; rank: number }) {
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <span className="text-xs font-bold text-neutral-400 w-4 text-center">{rank}</span>
      <span className="flex-1 font-semibold text-neutral-800 truncate">{w.name ?? "Konobar"}</span>
      <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${reliabilityColor(w.reliabilityScore ?? 0)}`}>
        {w.reliabilityScore}
      </span>
    </div>
  );
}

function Leaderboard({ scored }: { scored: WaiterReliability[] }) {
  const top = scored.slice(0, 3);
  const bottom = scored.slice(-3).reverse();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="dash-card p-4">
        <h3 className="font-bold text-neutral-900 text-sm mb-2">🏆 Najpouzdaniji</h3>
        {top.map((w, i) => <LeaderRow key={w.waiterId} w={w} rank={i + 1} />)}
      </div>
      <div className="dash-card p-4">
        <h3 className="font-bold text-neutral-900 text-sm mb-2">⚠️ Zahtevaju pažnju</h3>
        {bottom.map((w, i) => <LeaderRow key={w.waiterId} w={w} rank={scored.length - i} />)}
      </div>
    </div>
  );
}

/* ── CSV export ──────────────────────────────────────────────────────────── */

function buildCsv(waiters: WaiterReliability[]): string {
  const head = [
    "Konobar", "Pouzdanost", "Trend", "Na vreme %", "Prosek kašnjenja (min)",
    "Nedolasci", "Kasni otkazi", "Rani izlazi", "Sati", "Zahtevi za zamenu",
    "Gost prosek", "Gost recenzije", "Tier", "Sanitarna",
  ];
  const rows = waiters.map((w) => [
    (w.name ?? "Konobar").replace(/"/g, '""'),
    w.reliabilityScore ?? "",
    w.reliabilityDelta ?? "",
    w.onTimePct ?? "",
    w.avgLateMinutes ?? "",
    w.noShows,
    w.lateCancels,
    w.earlyExits,
    w.hoursWorked,
    w.swapRequests,
    w.guestRating?.overall ?? "",
    w.guestRating?.count ?? 0,
    w.passportTier,
    w.sanitaryBookValid ? "važeća" : "ne",
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function exportCsv(waiters: WaiterReliability[], period: number) {
  const blob = new Blob(["﻿" + buildCsv(waiters)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analitika-konobara-${period}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Waiter row ──────────────────────────────────────────────────────────── */

function metric(label: string, value: string) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-neutral-900">{value}</div>
      <div className="text-[10px] text-neutral-400 font-medium">{label}</div>
    </div>
  );
}

function WaiterRow({ w }: { w: WaiterReliability }) {
  return (
    <div className="dash-card p-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
          {getInitials(w.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 truncate">{w.name ?? "Konobar"}</span>
            {w.passportTier !== "FREE" && (
              <span className="bg-orange-50 text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">{w.passportTier}</span>
            )}
          </div>
          <div className="text-xs text-neutral-400">
            {w.completedShifts} odrađen{w.completedShifts === 1 ? "a" : "ih"} · {w.hoursWorked}h
            {w.missingClockOuts > 0 && ` · ${w.missingClockOuts} bez odjave`}
            {w.swapRequests > 0 && ` · ${w.swapRequests} zamen${w.swapRequests === 1 ? "a" : "e"}`}
          </div>
        </div>
        <div className="hidden sm:block flex-shrink-0" title="Aktivnost tokom perioda">
          <Sparkline series={w.activity} />
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <ReliabilityPill score={w.reliabilityScore} />
          <TrendArrow delta={w.reliabilityDelta} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-neutral-100">
        {metric("Na vreme", w.onTimePct !== null ? `${w.onTimePct}%` : "—")}
        {metric("Kašnjenje", w.avgLateMinutes !== null ? `${w.avgLateMinutes}min` : "—")}
        {metric("Nedolasci", String(w.noShows))}
        {metric("Rani izlaz", String(w.earlyExits))}
      </div>
      {w.measurableShifts < w.completedShifts && (
        <div className="text-[10px] text-neutral-400 mt-2">
          {w.measurableShifts} od {w.completedShifts} smena merljivo za tačnost
        </div>
      )}
      {w.guestRating && <GuestBlock g={w.guestRating} />}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

export default function VenueAnalyticsSection({ venue }: { venue: Venue | null }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const { data, isLoading } = useApi<WaiterAnalytics>(
    venue ? `/api/venues/${venue.id}/waiter-analytics?period=${period}` : "",
    { enabled: !!venue },
  );

  if (!venue) {
    return <div className="dash-card p-10 text-center text-neutral-400">Dodaj lokal da vidiš analitiku.</div>;
  }
  if (isLoading || !data) return <AnalyticsSkeleton />;

  const { team, waiters, flags } = data;
  const scored = waiters.filter(w => w.reliabilityScore !== null);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-black text-neutral-900">Analitika konobara</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
            {ANALYTICS_PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  period === p.value ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportCsv(waiters, period)}
            disabled={waiters.length === 0}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-40"
            title="Izvezi CSV"
          >
            ↓ CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatTile label="Konobara" value={String(team.rosterSize)} />
        <StatTile
          label="Tim na vreme"
          value={team.teamOnTimePct !== null ? `${team.teamOnTimePct}%` : "—"}
          hint={`${team.totalCompleted} smena`}
        />
        <StatTile label="Nedolasci" value={String(team.totalNoShows)} hint={`od ${team.totalExpectedShifts} zakazanih`} />
        <StatTile
          label="Gosti"
          value={team.teamGuestRating !== null ? `${toStars(team.teamGuestRating)}★` : "—"}
          hint={`${team.teamGuestReviewCount} recenzija`}
        />
        <StatTile label="Ukupno sati" value={`${team.totalHours}h`} />
      </div>

      <FlagsStrip flags={flags} />

      {scored.length >= 5 && <Leaderboard scored={scored} />}

      {waiters.length === 0 ? (
        <div className="dash-card p-10 text-center text-neutral-400">
          Nema odrađenih smena u izabranom periodu.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {waiters.map(w => <WaiterRow key={w.waiterId} w={w} />)}
        </div>
      )}

      <p className="text-[11px] text-neutral-400 text-center">
        Pouzdanost je lokalna ocena (0–100) na osnovu dolazaka, tačnosti i otkaza u ovom lokalu.
        Prikazuje se od {3} odrađene smene.
      </p>
    </>
  );
}
