"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS,
  DEPARTMENT_LABELS, formatDate,
} from "@/lib/formatting/display-maps";
import { countLeaveDays, parseDateOnly } from "@/lib/leave/dates";
import { Sk } from "./waiter-helpers";
import type { LeaveBalanceEntry, LeaveBalanceResponse, WaiterLeaveRequest } from "./waiter-types";

const REQUESTABLE_TYPES = ["ANNUAL", "SICK", "UNPAID", "SPECIAL"] as const;

/* ── Balance ring ────────────────────────────────────────────────────────── */

function BalanceRing({ balance }: { balance: LeaveBalanceEntry }) {
  const total = balance.entitledDays + balance.carriedInDays;
  const used  = balance.usedDays;
  const pct   = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  // 44 radius → circumference for the progress stroke.
  const C = 2 * Math.PI * 44;

  return (
    <div className="dash-card p-5 flex items-center gap-5">
      <div className="relative flex-shrink-0">
        <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
          <circle cx="52" cy="52" r="44" fill="none" stroke="#f5f5f5" strokeWidth="10" />
          <circle cx="52" cy="52" r="44" fill="none" stroke="#f97316" strokeWidth="10"
            strokeLinecap="round" strokeDasharray={C}
            strokeDashoffset={C - (pct / 100) * C} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-neutral-900 leading-none">
            {balance.remainingDays}
          </span>
          <span className="text-[10px] text-neutral-400 font-bold">preostalo</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-black text-sm text-neutral-900 truncate">{balance.venue.name}</p>
        <p className="text-[10px] text-neutral-400 mb-2">
          {DEPARTMENT_LABELS[balance.department]} · {balance.year}
        </p>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-neutral-500">Ukupno</dt>
          <dd className="font-bold text-neutral-900 text-right">
            {total}{balance.carriedInDays > 0 && (
              <span className="text-neutral-400 font-normal"> (+{balance.carriedInDays})</span>
            )}
          </dd>

          <dt className="text-neutral-500">Iskorišćeno</dt>
          <dd className="font-bold text-neutral-900 text-right">{used}</dd>

          {balance.pendingDays > 0 && (
            <>
              <dt className="text-amber-600">Rezervisano</dt>
              <dd className="font-bold text-amber-600 text-right">{balance.pendingDays}</dd>
            </>
          )}

          {balance.sickDaysTaken > 0 && (
            <>
              <dt className="text-rose-600">Bolovanje</dt>
              <dd className="font-bold text-rose-600 text-right">{balance.sickDaysTaken}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

/* ── Request form ────────────────────────────────────────────────────────── */

type RequestForm = { type: string; startDate: string; endDate: string; reason: string };

function RequestModal({ balance, onClose, onSaved }: {
  balance: LeaveBalanceEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RequestForm>({
    type: "ANNUAL", startDate: "", endDate: "", reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const setField = <K extends keyof RequestForm>(k: K, v: RequestForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Mirrors the server's count so the worker sees the cost before submitting.
  const days = useMemo(() => {
    const from = parseDateOnly(form.startDate);
    const to   = parseDateOnly(form.endDate);
    if (!from || !to || to < from) return 0;
    return countLeaveDays(from, to, balance.policy.countWeekends);
  }, [form.startDate, form.endDate, balance.policy.countWeekends]);

  const overBudget = form.type === "ANNUAL" && days > balance.remainingDays;
  const valid = !!form.startDate && !!form.endDate && days > 0 && !overBudget;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId:   balance.venue.id,
          type:      form.type,
          startDate: form.startDate,
          endDate:   form.endDate,
          reason:    form.reason || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Greška pri slanju zahteva");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[88dvh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-neutral-900">Zatraži odsustvo</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-xl leading-none">×</button>
          </div>
          <p className="text-xs text-neutral-500 -mt-2">{balance.venue.name}</p>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase">Vrsta</span>
            <select value={form.type} onChange={e => setField("type", e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
              {REQUESTABLE_TYPES.map(t => (
                <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Od</span>
              <input type="date" value={form.startDate}
                onChange={e => setField("startDate", e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Do</span>
              <input type="date" value={form.endDate} min={form.startDate}
                onChange={e => setField("endDate", e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
            </label>
          </div>

          {days > 0 && (
            <div className={`rounded-xl p-3 text-xs ${
              overBudget ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-600"
            }`}>
              <strong>{days}</strong> {days === 1 ? "dan" : "dana"}
              {form.type === "ANNUAL" && (
                <> · ostaje vam <strong>{balance.remainingDays - days}</strong></>
              )}
              {overBudget && <div className="mt-1 font-bold">Nemate dovoljno dana.</div>}
              {!balance.policy.countWeekends && (
                <div className="mt-1 text-neutral-400">Vikendi se ne računaju.</div>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase">Napomena (opciono)</span>
            <textarea value={form.reason} onChange={e => setField("reason", e.target.value)} rows={2}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none" />
          </label>

          <p className="text-[10px] text-neutral-400">
            {balance.policy.autoApprove
              ? `Zahtev se odobrava automatski ako je najavljen ${balance.policy.minNoticeDays} dana unapred i ima mesta.`
              : "Lokal ručno odobrava svaki zahtev."}
          </p>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
              Otkaži
            </button>
            <button onClick={submit} disabled={!valid || saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
              {saving ? "Slanje…" : "Pošalji"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Request list ────────────────────────────────────────────────────────── */

function MyRequestRow({ r, busy, onCancel }: {
  r: WaiterLeaveRequest;
  busy: boolean;
  onCancel: () => void;
}) {
  const upcoming = new Date(r.endDate) >= new Date();
  const cancellable = (r.status === "PENDING" || (r.status === "APPROVED" && upcoming));

  return (
    <div className="dash-card p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEAVE_TYPE_COLORS[r.type]}`}>
            {LEAVE_TYPE_LABELS[r.type] ?? r.type}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEAVE_STATUS_COLORS[r.status]}`}>
            {LEAVE_STATUS_LABELS[r.status]}
          </span>
          {r.autoApproved && (
            <span className="text-[10px] text-green-600 font-bold">automatski</span>
          )}
        </div>
        <p className="text-sm font-bold text-neutral-900 mt-1">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
          <span className="text-neutral-400 font-normal"> · {r.days} {r.days === 1 ? "dan" : "dana"}</span>
        </p>
        <p className="text-[10px] text-neutral-400">{r.venue.name}</p>
        {r.rejectReason && <p className="text-xs text-red-600 mt-1">Odbijeno: {r.rejectReason}</p>}
      </div>

      {cancellable && (
        <button onClick={onCancel} disabled={busy}
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50 flex-shrink-0 disabled:opacity-50">
          Otkaži
        </button>
      )}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

export default function WaiterOdmoriSection() {
  const [requesting, setRequesting] = useState<LeaveBalanceEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const { data: bal, isLoading: balLoading, mutate: refetchBalance } =
    useApi<LeaveBalanceResponse>("/api/leave/balance");
  const { data: reqs, isLoading: reqLoading, mutate: refetchRequests } =
    useApi<{ requests: WaiterLeaveRequest[] }>("/api/leave/requests");

  if (balLoading || reqLoading) {
    return (
      <>
        <Sk className="h-32" />
        <Sk className="h-24" />
        <Sk className="h-24" />
      </>
    );
  }

  const balances = bal?.balances ?? [];
  const requests = reqs?.requests ?? [];

  // Leave only exists in the context of a roster. Without one there is nothing
  // to show and nothing to request.
  if (balances.length === 0) {
    return (
      <div className="dash-card p-8 text-center">
        <p className="text-sm font-bold text-neutral-900">Niste ni u jednom timu</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
          Odmori se vode po lokalu. Kada vas lokal doda na spisak osoblja,
          ovde ćete videti koliko dana imate i moći da ih zatražite.
        </p>
      </div>
    );
  }

  const cancel = async (r: WaiterLeaveRequest) => {
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/leave/requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Greška");
        return;
      }
      await Promise.all([refetchBalance(), refetchRequests()]);
    } finally {
      setBusyId(null);
    }
  };

  const refresh = () => Promise.all([refetchBalance(), refetchRequests()]);

  const active = requests.filter(r => r.status === "PENDING" || r.status === "APPROVED");
  const past   = requests.filter(r => r.status === "REJECTED" || r.status === "CANCELLED");

  return (
    <>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* One balance per venue — leave at one says nothing about the other. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {balances.map(b => (
          <div key={b.staffId} className="flex flex-col gap-2">
            <BalanceRing balance={b} />
            <button onClick={() => setRequesting(b)}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600">
              + Zatraži odsustvo — {b.venue.name}
            </button>
          </div>
        ))}
      </div>

      {active.length > 0 && (
        <>
          <h3 className="text-sm font-black text-neutral-900 mt-2">Aktuelni zahtevi</h3>
          <div className="flex flex-col gap-2">
            {active.map(r => (
              <MyRequestRow key={r.id} r={r} busy={busyId === r.id} onCancel={() => cancel(r)} />
            ))}
          </div>
        </>
      )}

      {active.length === 0 && (
        <div className="dash-card p-6 text-center">
          <p className="text-sm font-bold text-neutral-900">Nemate zakazanih odmora</p>
          <p className="text-xs text-neutral-500 mt-1">
            Zatražite odsustvo dugmetom iznad.
          </p>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h3 className="text-sm font-black text-neutral-500 mt-2">Istorija</h3>
          <div className="flex flex-col gap-2 opacity-70">
            {past.map(r => (
              <MyRequestRow key={r.id} r={r} busy={false} onCancel={() => {}} />
            ))}
          </div>
        </>
      )}

      {requesting && (
        <RequestModal balance={requesting}
          onClose={() => setRequesting(null)}
          onSaved={refresh} />
      )}
    </>
  );
}
