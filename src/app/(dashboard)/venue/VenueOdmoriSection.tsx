"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { DEPARTMENT_LABELS } from "@/lib/formatting/display-maps";
import { formatDateOnly, parseDateOnly } from "@/lib/leave/dates";
import { Sk } from "./venue-helpers";
import VenueLeaveRequests from "./VenueLeaveRequests";
import type { Venue, BlackoutsResponse, LeavePolicyResponse, LeavePolicyRow } from "./venue-types";

type Dept = "FOH" | "BOH";
type Tab  = "zahtevi" | "kalendar" | "podesavanja";

const MONTHS = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];
/** Monday-first, matching the Serbian calendar convention. */
const WEEKDAY_INITIALS = ["P", "U", "S", "Č", "P", "S", "N"];
/** Monday-first index → JS getUTCDay value, for the weekday filter chips. */
const WEEKDAY_TO_JS = [1, 2, 3, 4, 5, 6, 0];

/* ── Month grid ──────────────────────────────────────────────────────────── */

function MonthGrid({ year, month, blocked, onToggle, disabled }: {
  year: number;
  month: number;
  /** date string → maxOff for that day */
  blocked: Map<string, number>;
  onToggle: (date: string, currentlyBlocked: boolean) => void;
  disabled: boolean;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay is Sunday-first; shift so Monday is column 0.
  const leadingBlanks = (first.getUTCDay() + 6) % 7;

  return (
    <div className="dash-card p-3">
      <p className="text-xs font-black text-neutral-900 mb-2">{MONTHS[month]}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span key={i} className="text-[9px] text-neutral-400 text-center font-bold">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: leadingBlanks }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day  = i + 1;
          const date = formatDateOnly(new Date(Date.UTC(year, month, day)));
          const maxOff = blocked.get(date);
          const isBlocked = maxOff === 0;
          const isCapped  = maxOff !== undefined && maxOff > 0;

          return (
            <button
              key={date}
              disabled={disabled}
              onClick={() => onToggle(date, maxOff !== undefined)}
              title={
                isBlocked ? "Niko ne može biti slobodan"
                : isCapped ? `Najviše ${maxOff} slobodnih`
                : "Slobodno po pravilniku"
              }
              className={`aspect-square text-[10px] font-bold rounded transition ${
                isBlocked
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : isCapped
                    ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                    : "text-neutral-600 hover:bg-orange-100"
              } ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}>
              {isCapped ? maxOff : day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bulk range tool ─────────────────────────────────────────────────────── */

type BulkForm = { from: string; to: string; maxOff: number; weekdays: number[]; reason: string };

function BulkTool({ busy, onApply }: {
  busy: boolean;
  onApply: (form: BulkForm, mode: "block" | "unblock") => void;
}) {
  const [form, setForm] = useState<BulkForm>({
    from: "", to: "", maxOff: 0, weekdays: [], reason: "",
  });
  const setField = <K extends keyof BulkForm>(k: K, v: BulkForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleWeekday = (js: number) =>
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(js) ? f.weekdays.filter(d => d !== js) : [...f.weekdays, js],
    }));

  const valid = !!form.from && !!form.to;

  return (
    <div className="dash-card p-4 flex flex-col gap-3">
      <p className="text-sm font-black text-neutral-900">Označi više dana odjednom</p>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase">Od</span>
          <input type="date" value={form.from} onChange={e => setField("from", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase">Do</span>
          <input type="date" value={form.to} onChange={e => setField("to", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs" />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-neutral-500 uppercase">
          Samo ovi dani <span className="font-normal normal-case">(prazno = svi)</span>
        </span>
        <div className="flex gap-1">
          {WEEKDAY_INITIALS.map((label, i) => {
            const js = WEEKDAY_TO_JS[i];
            const on = form.weekdays.includes(js);
            return (
              <button key={i} onClick={() => toggleWeekday(js)}
                className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition ${
                  on ? "bg-orange-500 text-white border-orange-500"
                     : "bg-white text-neutral-500 border-neutral-200 hover:border-orange-300"
                }`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-neutral-500 uppercase">
          Najviše slobodnih <span className="font-normal normal-case">(0 = svi rade)</span>
        </span>
        <input type="number" min={0} max={99} value={form.maxOff}
          onChange={e => setField("maxOff", Math.max(0, Number(e.target.value) || 0))}
          className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs w-24" />
      </label>

      <div className="flex gap-2">
        <button disabled={!valid || busy} onClick={() => onApply(form, "block")}
          className="flex-1 px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50">
          Označi
        </button>
        <button disabled={!valid || busy} onClick={() => onApply(form, "unblock")}
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-xs font-bold hover:bg-neutral-50 disabled:opacity-50">
          Poništi
        </button>
      </div>
    </div>
  );
}

/* ── Policy form ─────────────────────────────────────────────────────────── */

function PolicyPanel({ venueId, policy, canManage, onSaved }: {
  venueId: string;
  policy: LeavePolicyRow;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(policy);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  const setField = <K extends keyof LeavePolicyRow>(k: K, v: LeavePolicyRow[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leave/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId, department: policy.department,
          annualDays:       form.annualDays,
          maxConcurrentOff: form.maxConcurrentOff,
          minNoticeDays:    form.minNoticeDays,
          autoApprove:      form.autoApprove,
          countWeekends:    form.countWeekends,
          allowCarryOver:   form.allowCarryOver,
          carryOverDays:    form.carryOverDays,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Greška pri čuvanju");
        return;
      }
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const num = (label: string, key: "annualDays" | "maxConcurrentOff" | "minNoticeDays" | "carryOverDays", hint?: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-neutral-500 uppercase">{label}</span>
      <input type="number" min={0} value={form[key]} disabled={!canManage}
        onChange={e => setField(key, Math.max(0, Number(e.target.value) || 0))}
        className="px-2 py-1.5 rounded-lg border border-neutral-200 text-sm disabled:bg-neutral-50" />
      {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
    </label>
  );

  const check = (label: string, key: "autoApprove" | "countWeekends" | "allowCarryOver", hint: string) => (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={form[key]} disabled={!canManage}
        onChange={e => setField(key, e.target.checked)} className="mt-0.5 accent-orange-500" />
      <span>
        <span className="text-xs font-bold text-neutral-900 block">{label}</span>
        <span className="text-[10px] text-neutral-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="dash-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-neutral-900">
          Pravilnik — {DEPARTMENT_LABELS[policy.department]}
        </p>
        {!policy.configured && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
            podrazumevano
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {num("Dana godišnjeg", "annualDays", "Zakonski minimum je 20")}
        {num("Najviše slobodnih dnevno", "maxConcurrentOff")}
        {num("Najava unapred (dana)", "minNoticeDays")}
        {num("Prenos u sledeću godinu", "carryOverDays")}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-3">
        {check("Automatsko odobravanje", "autoApprove",
          "Zahtev koji prolazi sve provere se odobrava odmah")}
        {check("Računaj vikende", "countWeekends",
          "Isključite samo ako vikendom ne radite")}
        {check("Dozvoli prenos dana", "allowCarryOver",
          "Neiskorišćeni dani prelaze u sledeću godinu")}
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      {canManage && (
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50">
          {saving ? "Čuvanje…" : saved ? "Sačuvano ✓" : "Sačuvaj pravilnik"}
        </button>
      )}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

export default function VenueOdmoriSection({ venue }: { venue: Venue | null }) {
  const [tab, setTab]   = useState<Tab>("zahtevi");
  const [dept, setDept] = useState<Dept>("FOH");
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venueId = venue?.id ?? "";

  const blackoutsUrl = venueId
    ? `/api/leave/blackouts?venueId=${venueId}&department=${dept}&from=${year}-01-01&to=${year}-12-31`
    : "";
  const { data: bo, isLoading: boLoading, mutate: refetchBlackouts } =
    useApi<BlackoutsResponse>(blackoutsUrl, { enabled: !!venueId });

  const { data: pol, isLoading: polLoading, mutate: refetchPolicy } =
    useApi<LeavePolicyResponse>(venueId ? `/api/leave/policy?venueId=${venueId}` : "", { enabled: !!venueId });

  const blocked = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bo?.blackouts ?? []) m.set(b.date, b.maxOff);
    return m;
  }, [bo]);

  if (!venue) {
    return <p className="text-sm text-neutral-500">Prvo kreirajte lokal u sekciji Profil.</p>;
  }
  if (boLoading || polLoading) {
    return (
      <>
        <Sk className="h-7 w-40" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Sk key={i} className="h-40" />)}
        </div>
      </>
    );
  }

  const hasKitchen = bo?.hasKitchen ?? false;
  const canManage  = bo?.canManageBlackouts ?? false;

  const write = async (
    method: "POST" | "DELETE",
    body: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leave/blackouts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, department: dept, ...body }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Greška");
        return;
      }
      await refetchBlackouts();
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (date: string, currentlyBlocked: boolean) => {
    if (!canManage) return;
    void write(currentlyBlocked ? "DELETE" : "POST", { from: date, to: date, maxOff: 0 });
  };

  const applyBulk = (form: BulkForm, mode: "block" | "unblock") => {
    const from = parseDateOnly(form.from);
    const to   = parseDateOnly(form.to);
    if (!from || !to) { setError("Nevažeći datum"); return; }
    if (to < from)    { setError("Krajnji datum je pre početnog"); return; }

    void write(mode === "block" ? "POST" : "DELETE", {
      from: form.from,
      to:   form.to,
      ...(form.weekdays.length > 0 && { weekdays: form.weekdays }),
      ...(mode === "block" && { maxOff: form.maxOff, reason: form.reason || null }),
    });
  };

  const blockedCount = [...blocked.values()].filter(v => v === 0).length;
  const cappedCount  = [...blocked.values()].filter(v => v > 0).length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-neutral-900">Odmori</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Svi dani su slobodni dok ih ne označite. {blockedCount} zatvorenih
            {cappedCount > 0 && `, ${cappedCount} ograničenih`} u {year}.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)}
            className="w-8 h-8 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 font-bold">‹</button>
          <span className="text-sm font-black text-neutral-900 w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="w-8 h-8 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 font-bold">›</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["zahtevi", "kalendar", "podesavanja"] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              tab === tb ? "bg-orange-500 text-white border-orange-500"
                         : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
            }`}>
            {tb === "zahtevi" ? "Zahtevi" : tb === "kalendar" ? "Kalendar" : "Pravilnik"}
          </button>
        ))}

        {/* Only a venue with a kitchen has two calendars to switch between. */}
        {hasKitchen && (
          <div className="flex gap-1 ml-auto">
            {(["FOH", "BOH"] as const).map(d => (
              <button key={d} onClick={() => setDept(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  dept === d ? "bg-neutral-900 text-white border-neutral-900"
                             : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                }`}>
                {DEPARTMENT_LABELS[d]}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {tab === "zahtevi" && (
        <VenueLeaveRequests venueId={venue.id} hasKitchen={hasKitchen}
          department={hasKitchen ? dept : null} />
      )}

      {tab === "kalendar" && (
        <>
          {canManage && <BulkTool busy={busy} onApply={applyBulk} />}

          <div className="flex items-center gap-4 text-[10px] text-neutral-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Svi rade</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Ograničen broj</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-100 inline-block" /> Slobodno</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MONTHS.map((_, m) => (
              <MonthGrid key={m} year={year} month={m} blocked={blocked}
                onToggle={toggleDay} disabled={!canManage || busy} />
            ))}
          </div>
        </>
      )}

      {tab === "podesavanja" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(pol?.policies ?? [])
            .filter(p => !hasKitchen || p.department === dept)
            .map(p => (
              <PolicyPanel key={p.department} venueId={venue.id} policy={p}
                canManage={pol?.canManagePolicy ?? false} onSaved={refetchPolicy} />
            ))}
        </div>
      )}
    </>
  );
}
