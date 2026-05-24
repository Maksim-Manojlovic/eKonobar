"use client";

import { useState, useEffect } from "react";
import type { WaiterShift, OpenShift, SwapRequest, ManagedShift } from "./waiter-types";
import { DAYS_SR, MONTHS_SR } from "@/lib/i18n-constants";
import { Spinner, WaiterShiftsSkeleton } from "./waiter-helpers";
/* ── Section: Shifts (waiter calendar + marketplace) ─────────────────────── */

type ShiftsTab = "mine" | "open" | "swaps";

function ClockInButton({ shift, onDone }: { shift: WaiterShift; onDone: () => void }) {
  const myAssignment = shift.assignments[0] ?? null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState("");

  if (!myAssignment) return null;

  if (myAssignment.clockOutAt) {
    return <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-1 rounded-full">Odjavljeni ✓</span>;
  }

  if (myAssignment.clockInAt) {
    return (
      <button onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/shifts/${shift.id}/clockout`, { method: "POST" });
        setBusy(false);
        if (res.ok) onDone(); else setMsg("Greška");
      }} disabled={busy}
        className="text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50">
        {busy ? "..." : msg || "Odjavi se"}
      </button>
    );
  }

  if (myAssignment.pendingClockIn) {
    return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Čekamo odobrenje...</span>;
  }

  // Check if within clock-in window (15min before scheduledStart)
  if (!shift.scheduledStart) return null;
  const windowOpen = new Date(new Date(shift.scheduledStart).getTime() - 15 * 60 * 1000);
  if (new Date() < windowOpen) return null;

  async function handleClockIn() {
    setBusy(true);
    setMsg("");

    let body: Record<string, unknown> = { method: "GPS" };
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      body = { method: "GPS", latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      // GPS unavailable — send without coords, backend requests manager approval
    }

    const r = await fetch(`/api/shifts/${shift.id}/clockin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const data = await r.json().catch(() => ({})) as { pending?: boolean };
      if (data.pending) {
        setMsg("Zahtev poslat vlasniku ✓");
      }
      onDone();
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg((d as { error?: string }).error ?? "Greška");
    }

    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleClockIn} disabled={busy}
        className="text-xs font-bold bg-green-500 text-white hover:bg-green-600 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 animate-pulse">
        {busy ? "..." : "Check-in"}
      </button>
      {msg && <span className="text-[10px] text-neutral-500">{msg}</span>}
    </div>
  );
}

export function ShiftsSection({ shifts, loading, onRefresh }: { shifts: WaiterShift[]; loading: boolean; onRefresh: () => void }) {
  const now = new Date();
  const [tab, setTab]           = useState<ShiftsTab>("mine");
  const [current, setCurrent]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<WaiterShift | null>(null);
  const [openShifts, setOpenShifts]   = useState<OpenShift[]>([]);
  const [swapReqs, setSwapReqs]       = useState<SwapRequest[]>([]);
  const [tabLoading, setTabLoading]   = useState(false);
  const [claiming, setClaiming]       = useState<string | null>(null);

  useEffect(() => {
    if (tab === "open") {
      // Initial load with spinner
      setTabLoading(true);
      fetch("/api/shifts?view=open").then(r => r.ok ? r.json() : []).then(setOpenShifts).finally(() => setTabLoading(false));
      // Silent 30s auto-refresh — no spinner on subsequent polls
      const id = setInterval(() => {
        fetch("/api/shifts?view=open").then(r => r.ok ? r.json() : []).then(setOpenShifts).catch(() => {});
      }, 30_000);
      return () => clearInterval(id);
    }
    if (tab === "swaps") {
      setTabLoading(true);
      fetch("/api/shifts?view=swaps").then(r => r.ok ? r.json() : []).then(setSwapReqs).finally(() => setTabLoading(false));
    }
  }, [tab]);

  async function handleClaim(shiftId: string) {
    setClaiming(shiftId);
    const res = await fetch(`/api/shifts/${shiftId}/claim`, { method: "POST" });
    setClaiming(null);
    if (res.ok) {
      onRefresh();
      setTab("mine");
    }
  }

  if (loading) return <WaiterShiftsSkeleton />;

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
    .slice(0, 8);

  const TABS: { key: ShiftsTab; label: string }[] = [
    { key: "mine",  label: "Moje smene" },
    { key: "open",  label: "Slobodne smene" },
    { key: "swaps", label: "Zahtevi" },
  ];

  return (
    <>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
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
              {selected.tipEstimate != null && (
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Očekivani bakšiš</div>
                  <div className="text-sm font-bold text-amber-600">~{selected.tipEstimate.toLocaleString("sr-RS")} RSD</div>
                </div>
              )}
              {selected.briefingNote && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                  <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mb-0.5">Briefing</div>
                  <div className="text-sm text-orange-800 leading-relaxed">{selected.briefingNote}</div>
                </div>
              )}
              {selected.notes && (
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-0.5">Napomena</div>
                  <div className="text-sm text-neutral-600 leading-relaxed">{selected.notes}</div>
                </div>
              )}
              {selected.assignments[0] && (
                <div className="border-t border-neutral-100 pt-3">
                  {selected.assignments[0].clockInAt ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Čekirani — {new Date(selected.assignments[0].clockInAt).toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}
                      {selected.assignments[0].lateMinutes != null && selected.assignments[0].lateMinutes > 0 && (
                        <span className="text-amber-600">(+{selected.assignments[0].lateMinutes}min)</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Još niste čekirani</span>
                      <ClockInButton shift={selected} onDone={() => { setSelected(null); onRefresh(); }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-black text-white">Smene</h2>
      </div>

      {/* Tab switcher */}
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${tab === t.key ? "active" : "text-neutral-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Moje smene ── */}
      {tab === "mine" && (
        <>
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
                          {dayShifts.slice(0, 2).map((s, idx) => {
                            const clocked = s.assignments[0]?.clockInAt;
                            return (
                              <div key={s.id}>
                                {idx > 0 && <div className="h-px bg-neutral-300/60 my-0.5 mx-0.5" />}
                                <div onClick={() => setSelected(s)}
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer transition-colors flex items-center gap-1 ${clocked ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-600 hover:bg-orange-200"}`}>
                                  {clocked && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                                  {s.startTime} {s.venue.name}
                                </div>
                              </div>
                            );
                          })}
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

          {shifts.length === 0 ? (
            <div className="dash-card p-10 text-center text-neutral-400 text-sm">
              Nemaš dodeljenih smena —{" "}
              <button onClick={() => setTab("open")} className="text-orange-500 font-semibold hover:underline">pogledaj slobodne smene</button>
            </div>
          ) : upcoming.length > 0 && (
            <div className="dash-card p-5">
              <h3 className="font-bold text-neutral-900 text-sm mb-3">Nadolazeće smene</h3>
              <div className="flex flex-col gap-0">
                {upcoming.map(s => {
                  const dateStr = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
                  const clocked = s.assignments[0]?.clockInAt;
                  return (
                    <div key={s.id}
                      className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                      <div className="cursor-pointer hover:opacity-75 transition-opacity flex-1 min-w-0" onClick={() => setSelected(s)}>
                        <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                          {clocked && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                          {s.venue.name}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {s.pay != null && <span className="font-black text-orange-500 text-sm">{s.pay.toLocaleString("sr-RS")} RSD</span>}
                        <ClockInButton shift={s} onDone={onRefresh} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Slobodne smene ── */}
      {tab === "open" && (
        <>
          <p className="text-xs text-neutral-400">Slobodne smene u svim lokalima — kliknite da preuzmete.</p>
          {tabLoading ? <Spinner /> : openShifts.length === 0 ? (
            <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema slobodnih smena trenutno</div>
          ) : (
            <div className="flex flex-col gap-3">
              {openShifts.map(s => {
                const dateStr = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
                const filled  = s.assignments.length;
                return (
                  <div key={s.id} className="dash-card p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-neutral-900 text-sm">{s.venue.name}</div>
                      <div className="text-xs text-neutral-500 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                      {s.role && <div className="text-xs text-neutral-400 mt-0.5">{s.role}</div>}
                      <div className="flex gap-3 mt-1.5 text-xs">
                        {s.pay != null && <span className="font-bold text-orange-500">{s.pay.toLocaleString("sr-RS")} RSD</span>}
                        {s.tipEstimate != null && <span className="text-amber-600">~{s.tipEstimate.toLocaleString("sr-RS")} RSD bakšiš</span>}
                        <span className="text-neutral-400">{filled}/{s.requiredCount} popunjeno</span>
                      </div>
                    </div>
                    <button onClick={() => handleClaim(s.id)} disabled={claiming === s.id}
                      className="btn-dash-orange px-3 py-1.5 text-xs flex-shrink-0 disabled:opacity-50">
                      {claiming === s.id ? "..." : "Preuzmi"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Zahtevi za zamenu ── */}
      {tab === "swaps" && (
        <>
          <p className="text-xs text-neutral-400">Kolege traže da preuzmeš njihovu smenu. Vlasnik mora odobriti zamenu.</p>
          {tabLoading ? <Spinner /> : swapReqs.length === 0 ? (
            <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema zahteva za zamenu</div>
          ) : (
            <div className="flex flex-col gap-3">
              {swapReqs.map(sw => {
                const dateStr = new Date(sw.shift.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={sw.id} className="dash-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-neutral-900 text-sm">{sw.shift.venue.name}</div>
                        <div className="text-xs text-neutral-500 capitalize">{dateStr} · {sw.shift.startTime}–{sw.shift.endTime}</div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {sw.fromAssignment.waiter.name ?? "Konobar"} traži zamenu
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-neutral-400">{new Date(sw.requestedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" })}</div>
                        <div className="text-[10px] text-amber-600 font-semibold mt-1">Čeka odobrenje vlasnika</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── Head Waiter Shift Management Section ────────────────────────────────── */

export function HeadWaiterSmeneSection({ venue, shifts, loading, onRefresh }: {
  venue: { id: string; name: string };
  shifts: ManagedShift[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [creating, setCreating]   = useState(false);
  const [swapActing, setSwapActing] = useState<string | null>(null);
  const [form, setForm]           = useState({ title: "", date: "", startTime: "18:00", endTime: "02:00", requiredCount: "1", pay: "", tipEstimate: "" });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  const now = new Date();
  const upcoming = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 20);

  const pendingSwaps = shifts.flatMap(s => s.swapRequests ?? []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSwapAction(swapId: string, action: "ACCEPTED" | "REJECTED") {
    setSwapActing(swapId);
    await fetch(`/api/shifts/swaps/${swapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setSwapActing(null);
    onRefresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:      venue.id,
        title:        form.title,
        date:         form.date,
        startTime:    form.startTime,
        endTime:      form.endTime,
        requiredCount: Number(form.requiredCount) || 1,
        pay:          form.pay ? Number(form.pay) : undefined,
        tipEstimate:  form.tipEstimate ? Number(form.tipEstimate) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setFormError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    setCreating(false);
    setForm({ title: "", date: "", startTime: "18:00", endTime: "02:00", requiredCount: "1", pay: "", tipEstimate: "" });
    onRefresh();
  }

  if (loading) return <WaiterShiftsSkeleton />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-0.5">Šef konobara</div>
          <div className="text-lg font-black text-neutral-900">{venue.name}</div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nova smena
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="dash-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-black text-neutral-900">Nova smena</span>
            <button onClick={() => setCreating(false)} className="text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Naziv *</label>
              <input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="npr. Večernja smena" className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Datum *</label>
              <input type="date" required value={form.date} onChange={e => set("date", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Broj mesta</label>
              <input type="number" min="1" value={form.requiredCount} onChange={e => set("requiredCount", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Početak</label>
              <input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Kraj</label>
              <input type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Plata (RSD)</label>
              <input type="number" value={form.pay} onChange={e => set("pay", e.target.value)} placeholder="po dogovoru" className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Bakšiš procena (RSD)</label>
              <input type="number" value={form.tipEstimate} onChange={e => set("tipEstimate", e.target.value)} placeholder="opciono" className="auth-input" />
            </div>
            {formError && <div className="col-span-2 text-xs text-red-500">{formError}</div>}
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-700">Otkaži</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
                {saving ? "Čuvanje…" : "Sačuvaj"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending swaps */}
      {pendingSwaps.length > 0 && (
        <div className="dash-card p-4 flex flex-col gap-3">
          <div className="text-sm font-black text-neutral-900">Zahtevi za zamenu ({pendingSwaps.length})</div>
          {pendingSwaps.map(sw => (
            <div key={sw.id} className="flex items-center gap-3 py-2 border-t border-neutral-50">
              <div className="flex-1 min-w-0 text-xs text-neutral-700">
                <span className="font-semibold">{sw.fromAssignment.waiter.name ?? "?"}</span>
                {" → "}
                <span className="font-semibold">{sw.toWaiter.name ?? "?"}</span>
              </div>
              <button
                onClick={() => handleSwapAction(sw.id, "ACCEPTED")}
                disabled={swapActing === sw.id}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">
                Odobri
              </button>
              <button
                onClick={() => handleSwapAction(sw.id, "REJECTED")}
                disabled={swapActing === sw.id}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                Odbij
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming shifts */}
      <div className="dash-card overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 text-sm font-black text-neutral-900">
          Nadolazeće smene ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-400">Nema nadolazećih smena</div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {upcoming.map(s => {
              const d = new Date(s.date);
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-neutral-500">{DAYS_SR[(d.getDay() + 6) % 7]}</span>
                    <span className="text-sm font-black text-neutral-900">{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-neutral-900 truncate">{s.title}</div>
                    <div className="text-xs text-neutral-400">{s.startTime}–{s.endTime} · {s.assignments.length}/{s.requiredCount} konobara</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    s.status === "OPEN" ? "bg-blue-50 text-blue-600" :
                    s.status === "ASSIGNED" ? "bg-green-50 text-green-700" :
                    s.status === "PENDING_SWAP" ? "bg-yellow-50 text-yellow-700" :
                    "bg-neutral-100 text-neutral-500"
                  }`}>{s.status === "OPEN" ? "Otvorena" : s.status === "ASSIGNED" ? "Popunjena" : s.status === "PENDING_SWAP" ? "Zamena" : s.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}