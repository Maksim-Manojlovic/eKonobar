"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { Venue, VenueShift, ShiftTemplate, TemplateMeta } from "./venue-types";
import { DAYS_SR, MONTHS_SR } from "@/lib/i18n/constants";
import { getInitials } from "@/lib/formatting/utils";
import { shiftsOverlap } from "@/lib/shifts/utils";
import { Sk, ShiftsSkeleton, EmptyVenue } from "./venue-helpers";
import { ShiftModal, TemplateModal, GenerateModal, DAYS_FULL_SR } from "./VenueSmeneModals";

const QUICK_APPLY_PRESETS: Array<{
  name: string; startTime: string; endTime: string;
  meta: TemplateMeta; label: string; sublabel: string;
}> = [
  { name: "Jutarnja Standard", startTime: "08:00", endTime: "16:00",
    meta: { type: "morning", label: "Jutarnja Standard", shift: "1" },
    label: "Smena 1", sublabel: "08:00 – 16:00 · Radni dani" },
  { name: "Jutarnja Kasna", startTime: "09:00", endTime: "17:00",
    meta: { type: "morning", label: "Jutarnja Kasna", shift: "1" },
    label: "Smena 1", sublabel: "09:00 – 17:00 · Radni dani" },
  { name: "Popodnevna Standard", startTime: "16:00", endTime: "23:30",
    meta: { type: "evening", label: "Popodnevna Standard", shift: "2" },
    label: "Smena 2", sublabel: "16:00 – 23:30 · Radni dani" },
  { name: "Popodnevna Kasna", startTime: "17:00", endTime: "00:00",
    meta: { type: "evening", label: "Popodnevna Kasna", shift: "2" },
    label: "Smena 2", sublabel: "17:00 – 00:00 · Radni dani" },
];

function ShiftTemplateTab({ venue, onShiftsChanged }: { venue: Venue; onShiftsChanged: () => void }) {
  const { data: templatesData, isLoading: loading, mutate: fetchTemplates } =
    useApi<ShiftTemplate[]>("/api/shifts/templates");
  const templates = templatesData ?? [];

  const [creating, setCreating]     = useState(false);
  const [editing, setEditing]       = useState<ShiftTemplate | null>(null);
  const [generating, setGenerating] = useState<ShiftTemplate | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [applying, setApplying]     = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/shifts/templates/${id}`, { method: "DELETE" });
    setDeleting(null);
    fetchTemplates();
  }

  async function applyPreset(preset: typeof QUICK_APPLY_PRESETS[0]) {
    setApplying(preset.name);
    await fetch("/api/shifts/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:      venue.id,
        name:         preset.name,
        weekdaysOnly: true,
        dayOfWeek:    null,
        metadata:     preset.meta,
        startTime:    preset.startTime,
        endTime:      preset.endTime,
        requiredCount: 2,
      }),
    });
    setApplying(null);
    fetchTemplates();
  }

  const overlapPairs: [string, string][] = [];
  for (let i = 0; i < templates.length; i++) {
    for (let j = i + 1; j < templates.length; j++) {
      if (shiftsOverlap(templates[i], templates[j])) {
        overlapPairs.push([templates[i].name, templates[j].name]);
      }
    }
  }

  const group1     = templates.filter(t => t.metadata?.shift === "1");
  const group2     = templates.filter(t => t.metadata?.shift === "2");
  const groupOther = templates.filter(t => !t.metadata?.shift);

  function TemplateCard({ t }: { t: ShiftTemplate }) {
    const dayLabel = t.weekdaysOnly ? "Radni dani" : (DAYS_FULL_SR[t.dayOfWeek ?? 0] ?? "");
    return (
      <div className="dash-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-bold text-neutral-900">{t.name}</div>
              {t.metadata?.shift && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.metadata.type === "morning" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                  Smena {t.metadata.shift}
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">{dayLabel} · {t.startTime}–{t.endTime}</div>
            <div className="flex gap-3 mt-1.5 text-xs text-neutral-400">
              <span>{t.requiredCount} {t.requiredCount === 1 ? "osoba" : "osobe"}</span>
              {t.role && <span>· {t.role}</span>}
              {t.pay != null && <span>· {t.pay.toLocaleString("sr-RS")} RSD</span>}
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => setEditing(t)}
              className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors">
              Uredi
            </button>
            <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting === t.id ? "..." : "Briši"}
            </button>
          </div>
        </div>
        <button onClick={() => setGenerating(t)} className="btn-dash-orange py-2 text-sm w-full">
          Generiši smene
        </button>
      </div>
    );
  }

  function GroupSection({ title, items, color }: { title: string; items: ShiftTemplate[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className={`text-xs font-black uppercase tracking-wider mb-2 ${color}`}>{title}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(t => <TemplateCard key={t.id} t={t} />)}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1,2,3,4].map(i => <Sk key={i} className="h-24 w-full" />)}
    </div>
  );

  const existingNames = new Set(templates.map(t => t.name));

  return (
    <>
      {(creating || editing) && (
        <TemplateModal
          template={editing}
          venueId={venue.id}
          onSave={() => { setCreating(false); setEditing(null); fetchTemplates(); }}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
      {generating && (
        <GenerateModal
          template={generating}
          onDone={() => { onShiftsChanged(); }}
          onClose={() => setGenerating(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white">Šabloni smena</h3>
          <p className="text-xs text-white/40 mt-0.5">Sačuvani obrasci za ponavljajuće smene. Kliknite &quot;Generiši&quot; za bulk kreiranje.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-dash-orange px-4 py-2">+ Novi šablon</button>
      </div>

      <div className="dash-card p-4">
        <div className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-3">Brzo dodaj predefinisanu smenu</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_APPLY_PRESETS.map(p => {
            const exists = existingNames.has(p.name);
            return (
              <button
                key={p.name}
                onClick={() => !exists && applyPreset(p)}
                disabled={exists || applying === p.name}
                className={[
                  "relative flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                  exists
                    ? "border-green-200 bg-green-50 cursor-default"
                    : "border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 cursor-pointer",
                  applying === p.name ? "opacity-60" : "",
                ].join(" ")}>
                <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${p.meta.type === "morning" ? "text-amber-500" : "text-indigo-500"}`}>
                  {p.label}
                </span>
                <span className="text-xs font-bold text-neutral-800 leading-tight">{p.name}</span>
                <span className="text-[11px] text-neutral-400 mt-0.5">{p.sublabel}</span>
                {exists && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
                {applying === p.name && <span className="text-[10px] text-orange-500 mt-1">Dodajem...</span>}
              </button>
            );
          })}
        </div>
      </div>

      {overlapPairs.length > 0 && (
        <div className="rounded-xl border border-amber-200 px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(251,191,36,0.08)", backdropFilter: "blur(8px)" }}>
          <svg className="flex-shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div className="text-xs font-bold text-amber-700">Vremensko preklapanje smena</div>
            <div className="text-xs text-amber-600 mt-0.5">
              {overlapPairs.map(([a, b]) => `"${a}" i "${b}"`).join(" · ")} — isti konobar ne može biti u obe smene.
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">
          Nema šablona — koristite brzo dodavanje iznad ili &quot;+ Novi šablon&quot;
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <GroupSection title="Smena 1 — Jutarnja" items={group1} color="text-amber-600" />
          <GroupSection title="Smena 2 — Popodnevna" items={group2} color="text-indigo-600" />
          <GroupSection title="Ostalo" items={groupOther} color="text-neutral-500" />
        </div>
      )}
    </>
  );
}

/* ── Staffing bar ────────────────────────────────────────────────────────── */

function StaffingBar({ filled, required }: { filled: number; required: number }) {
  const pct = required > 0 ? Math.min(filled / required, 1) : 0;
  const cls = pct === 0 ? "bg-red-400" : pct < 1 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`text-[9px] font-bold ${pct === 0 ? "text-red-500" : pct < 1 ? "text-amber-600" : "text-green-700"}`}>
        {filled}/{required}
      </span>
    </div>
  );
}

/* ── Head Waiter Panel ───────────────────────────────────────────────────── */

function HeadWaiterPanel({ venue, waiters, onRefresh }: {
  venue: Venue;
  waiters: { id: string; name: string | null }[];
  onRefresh: () => void;
}) {
  const [busy, setBusy]         = useState(false);
  const [selectId, setSelectId] = useState("");
  const [editing, setEditing]   = useState(false);

  async function appoint(waiterId: string) {
    if (!waiterId) return;
    setBusy(true);
    await fetch(`/api/venues/${venue.id}/head-waiter`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId }),
    });
    setBusy(false);
    setSelectId("");
    setEditing(false);
    onRefresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/venues/${venue.id}/head-waiter`, { method: "DELETE" });
    setBusy(false);
    onRefresh();
  }

  const availableWaiters = waiters.filter(w => w.id !== venue.headWaiter?.id);

  return (
    <div className="dash-card p-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-neutral-500 mb-0.5">Šef konobara</div>
        {venue.headWaiter ? (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">
              {(venue.headWaiter.name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="text-sm font-bold text-neutral-900">{venue.headWaiter.name ?? "—"}</span>
            <span className="text-[10px] bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Aktivan</span>
          </div>
        ) : (
          <div className="text-sm text-neutral-400">Nije postavljen</div>
        )}
      </div>

      {venue.headWaiter ? (
        editing ? (
          <div className="flex items-center gap-2">
            <select
              value={selectId}
              onChange={e => setSelectId(e.target.value)}
              className="auth-input py-1.5 text-xs w-44">
              <option value="">Izaberi novog šefa…</option>
              {availableWaiters.map(w => (
                <option key={w.id} value={w.id}>{w.name ?? w.id}</option>
              ))}
            </select>
            <button
              onClick={() => appoint(selectId)}
              disabled={!selectId || busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40">
              Potvrdi
            </button>
            <button
              onClick={() => { setEditing(false); setSelectId(""); }}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50">
              Otkaži
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors disabled:opacity-50">
              Izmeni
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50">
              Ukloni
            </button>
          </div>
        )
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectId}
            onChange={e => setSelectId(e.target.value)}
            className="auth-input py-1.5 text-xs w-44">
            <option value="">Izaberi konobara…</option>
            {waiters.map(w => (
              <option key={w.id} value={w.id}>{w.name ?? w.id}</option>
            ))}
          </select>
          <button
            onClick={() => appoint(selectId)}
            disabled={!selectId || busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40">
            Postavi
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Pending clock-in approval row ───────────────────────────────────────── */

function PendingClockInRow({ assignment, onDone }: {
  assignment: { id: string; waiter: { id: string; name: string | null } };
  onDone: () => void;
}) {
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  async function handle(action: "approve" | "reject") {
    setActing(action);
    await fetch(`/api/shifts/assignments/${assignment.id}/approve-clockin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    onDone();
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
      <span className="text-[10px] font-semibold text-amber-800 truncate">
        {assignment.waiter.name ?? "Konobar"} — čeka prijavu
      </span>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => handle("approve")}
          disabled={acting !== null}
          className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full hover:bg-green-600 disabled:opacity-50 transition-colors">
          {acting === "approve" ? "..." : "Odobri"}
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={acting !== null}
          className="text-[10px] font-bold bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full hover:bg-neutral-300 disabled:opacity-50 transition-colors">
          {acting === "reject" ? "..." : "Odbij"}
        </button>
      </div>
    </div>
  );
}

/* ── Section: Smene (venue) ──────────────────────────────────────────────── */

export default function VenueSmeneSection({ venue, shifts, loading, acceptedWaiters, onRefresh }: {
  venue: Venue | null;
  shifts: VenueShift[];
  loading: boolean;
  acceptedWaiters: { id: string; name: string | null }[];
  onRefresh: () => void;
}) {
  const now = new Date();
  const [mainTab, setMainTab]   = useState<"kalendar" | "sabloni">("kalendar");
  const [current, setCurrent]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [creating, setCreating] = useState<Date | null>(null);
  const [editing, setEditing]   = useState<VenueShift | null>(null);
  const [swapActing, setSwapActing] = useState<string | null>(null);

  if (loading) return <ShiftsSkeleton />;
  if (!venue)  return <EmptyVenue onNavigate={() => {}} />;

  const year  = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7;
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
    .slice(0, 8);

  const pendingSwaps = shifts.flatMap(s => s.swapRequests ?? []);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

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

      <HeadWaiterPanel venue={venue} waiters={acceptedWaiters} onRefresh={onRefresh} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => setMainTab("kalendar")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mainTab === "kalendar" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"}`}>
            Kalendar
          </button>
          <button
            onClick={() => setMainTab("sabloni")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mainTab === "sabloni" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"}`}>
            Šabloni
          </button>
        </div>
        {mainTab === "kalendar" && (
          <button onClick={() => setCreating(now)} className="btn-dash-orange px-4 py-2">+ Nova smena</button>
        )}
      </div>

      {mainTab === "sabloni" && <ShiftTemplateTab venue={venue} onShiftsChanged={onRefresh} />}

      {mainTab === "kalendar" && <>

      {pendingSwaps.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider mb-3">Zahtevi za zamenu ({pendingSwaps.length})</h3>
          <div className="flex flex-col gap-2">
            {pendingSwaps.map(sw => {
              const parentShift = shifts.find(s => s.swapRequests?.some(r => r.id === sw.id));
              const dateStr = parentShift
                ? new Date(parentShift.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" })
                : "";
              return (
                <div key={sw.id} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-neutral-800">
                      {sw.fromAssignment.waiter.name ?? "Konobar"}
                    </span>
                    <span className="text-xs text-neutral-400 ml-1.5">→ {sw.toWaiter.name ?? "Konobar"}</span>
                    {dateStr && <div className="text-xs text-neutral-400 mt-0.5">{parentShift?.title} · {dateStr}</div>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleSwapAction(sw.id, "ACCEPTED")} disabled={swapActing === sw.id}
                      className="text-xs font-bold bg-green-500 text-white hover:bg-green-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                      {swapActing === sw.id ? "..." : "Odobri"}
                    </button>
                    <button onClick={() => handleSwapAction(sw.id, "REJECTED")} disabled={swapActing === sw.id}
                      className="text-xs font-bold bg-neutral-100 text-neutral-500 hover:bg-neutral-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                      Odbij
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    <div className="flex flex-col gap-0.5">
                      {dayShifts.slice(0, 2).map((s, idx) => {
                        const filled  = s.assignments.length;
                        const clocked = s.assignments.filter(a => a.clockInAt).length;
                        const hasSwap = (s.swapRequests?.length ?? 0) > 0;
                        const isOpen  = s.status === "OPEN";
                        return (
                          <div key={s.id}>
                            {idx > 0 && <div className="h-px bg-neutral-300/60 my-0.5 mx-0.5" />}
                            <div
                              onClick={e => { e.stopPropagation(); setEditing(s); }}
                              title="Kliknite za uređivanje"
                              className={`text-[10px] font-semibold px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity min-w-0 ${isOpen ? "bg-orange-100 text-orange-600" : hasSwap ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                              <div className="flex items-center gap-0.5 min-w-0">
                                {clocked > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                                {hasSwap && <span className="text-[8px] flex-shrink-0">🔄</span>}
                                <span className="truncate">{s.startTime}</span>
                              </div>
                              <StaffingBar filled={filled} required={s.requiredCount} />
                              {s.assignments.length > 0 && (
                                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                                  {s.assignments.slice(0, 3).map(a => (
                                    <span key={a.id} title={a.waiter.name ?? "Konobar"}
                                      className="w-3 h-3 rounded-full bg-white/70 text-orange-700 flex items-center justify-center text-[7px] font-black flex-shrink-0 border border-orange-200">
                                      {getInitials(a.waiter.name).slice(0, 1)}
                                    </span>
                                  ))}
                                  {s.assignments.length > 3 && (
                                    <span className="text-[7px] text-neutral-400 leading-3 self-center">+{s.assignments.length - 3}</span>
                                  )}
                                </div>
                              )}
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

      <div className="flex flex-wrap gap-4 text-xs text-white/45">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" />Slobodna smena</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />Popunjena</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" />Zamena na čekanju 🔄</span>
        <span className="text-white/30">Kliknite na dan za novu smenu · na smenu za uređivanje</span>
      </div>

      {upcoming.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-3">Nadolazeće smene</h3>
          <div className="flex flex-col gap-0">
            {upcoming.map(s => {
              const dateStr  = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
              const filled   = s.assignments.length;
              const clocked  = s.assignments.filter(a => a.clockInAt && !a.clockOutAt).length;
              return (
                <div key={s.id} onClick={() => setEditing(s)}
                  className="py-2.5 border-b border-neutral-100 last:border-0 cursor-pointer hover:opacity-75 transition-opacity">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                        {clocked > 0 && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
                        {s.title}
                        {s.role && <span className="ml-1 text-[11px] text-neutral-400 font-normal">· {s.role}</span>}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 min-w-[100px]">
                      <StaffingBar filled={filled} required={s.requiredCount} />
                      {filled > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap justify-end">
                          {s.assignments.map(a => (
                            <span key={a.id} title={a.waiter.name ?? "Konobar"}
                              className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                              {getInitials(a.waiter.name)}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.pay != null && <div className="text-xs font-black text-orange-500 mt-0.5">{s.pay.toLocaleString("sr-RS")} RSD</div>}
                    </div>
                  </div>
                  {clocked > 0 && (
                    <div className="mt-1 flex gap-1.5 flex-wrap">
                      {s.assignments.filter(a => a.clockInAt && !a.clockOutAt).map(a => (
                        <span key={a.id} className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {a.waiter.name ?? "Konobar"}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.assignments.some(a => a.pendingClockIn) && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {s.assignments.filter(a => a.pendingClockIn).map(a => (
                        <PendingClockInRow key={a.id} assignment={a} onDone={onRefresh} />
                      ))}
                    </div>
                  )}
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

      </>}
    </>
  );
}