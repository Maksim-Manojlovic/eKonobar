"use client";

import { useState } from "react";
import type { Venue, VenueShift, ShiftTemplate } from "./venue-types";
import { getInitials } from "@/lib/formatting/utils";
/* ── Shift modal ─────────────────────────────────────────────────────────── */

export function ShiftModal({ shift, date, venue, waiters, onSave, onDelete, onClose }: {
  shift: VenueShift | null;
  date: Date | null;
  venue: Venue;
  waiters: { id: string; name: string | null }[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const toInput = (d: Date) => d.toLocaleDateString("sv-SE");
  const [form, setForm] = useState({
    title:         shift?.title          ?? "",
    date:          shift ? shift.date.slice(0, 10) : (date ? toInput(date) : ""),
    startTime:     shift?.startTime      ?? "18:00",
    endTime:       shift?.endTime        ?? "02:00",
    role:          shift?.role           ?? "",
    requiredCount: shift?.requiredCount?.toString() ?? "1",
    tipEstimate:   shift?.tipEstimate?.toString()   ?? "",
    pay:           shift?.pay?.toString()            ?? "",
    briefingNote:  shift?.briefingNote   ?? "",
    notes:         shift?.notes          ?? "",
    swapLocked:    shift?.swapLocked     ?? false,
    waiterIds:     shift?.assignments.map(a => a.waiterId) ?? [] as string[],
  });
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError]           = useState("");

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  const toggleWaiter = (id: string) =>
    setForm(p => ({
      ...p,
      waiterIds: p.waiterIds.includes(id)
        ? p.waiterIds.filter(w => w !== id)
        : [...p.waiterIds, id],
    }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url    = shift ? `/api/shifts/${shift.id}` : "/api/shifts";
    const method = shift ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:      venue.id,
        title:        form.title,
        date:         form.date,
        startTime:    form.startTime,
        endTime:      form.endTime,
        role:         form.role         || undefined,
        requiredCount: Number(form.requiredCount) || 1,
        tipEstimate:  form.tipEstimate  ? Number(form.tipEstimate) : undefined,
        pay:          form.pay          ? Number(form.pay) : undefined,
        briefingNote: form.briefingNote || undefined,
        notes:        form.notes        || undefined,
        swapLocked:   form.swapLocked,
        waiterIds:    form.waiterIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    onSave();
  }

  async function handleDelete() {
    if (!shift) return;
    setDeleting(true);
    await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
    setDeleting(false);
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">{shift ? "Uredi smenu" : "Nova smena"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naziv smene *</label>
            <input type="text" required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="npr. Večernja smena" className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Datum *</label>
            <input type="date" required value={form.date} onChange={e => set("date", e.target.value)}
              className="auth-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od *</label>
              <input type="time" required value={form.startTime} onChange={e => set("startTime", e.target.value)}
                className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do *</label>
              <input type="time" required value={form.endTime} onChange={e => set("endTime", e.target.value)}
                className="auth-input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Broj ljudi</label>
            <input type="number" min={1} max={20} value={form.requiredCount} onChange={e => set("requiredCount", e.target.value)}
              className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Briefing za smenu</label>
            <textarea value={form.briefingNote} onChange={e => set("briefingNote", e.target.value)}
              rows={2} placeholder="Vidljivo samo konobaru 2h pre smene..." className="auth-input resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Konobari</label>
            {waiters.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Nema prihvaćenih konobara za ovaj lokal.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto border border-neutral-200 rounded-xl p-2">
                {waiters.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.waiterIds.includes(w.id)} onChange={() => toggleWaiter(w.id)}
                      className="w-4 h-4 rounded accent-orange-500 flex-shrink-0" />
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-[9px] flex-shrink-0">
                      {getInitials(w.name)}
                    </div>
                    <span className="text-sm text-neutral-700">{w.name ?? w.id.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-semibold text-neutral-700">Blokiraj zamene</div>
              <div className="text-[11px] text-neutral-400">Konobari ne mogu menjati ovu smenu</div>
            </div>
            <button type="button" onClick={() => set("swapLocked", !form.swapLocked)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.swapLocked ? "bg-orange-500" : "bg-neutral-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.swapLocked ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-dash-orange flex-1 py-2.5 disabled:opacity-60">
              {saving ? "Čuvanje..." : (shift ? "Sačuvaj" : "Dodaj smenu")}
            </button>
            {shift && !confirmDel && (
              <button type="button" onClick={() => setConfirmDel(true)}
                className="btn-dash-outline px-4 py-2.5 text-red-400 hover:border-red-300 hover:text-red-500">
                Obriši
              </button>
            )}
            {shift && confirmDel && (
              <button type="button" disabled={deleting} onClick={handleDelete}
                className="btn-dash-outline px-4 py-2.5 border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-60">
                {deleting ? "..." : "Potvrdi?"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Template modal ──────────────────────────────────────────────────────── */

export const DAYS_FULL_SR = ["Nedjelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

export function TemplateModal({ template, venueId, onSave, onClose }: {
  template: ShiftTemplate | null;
  venueId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name:          template?.name              ?? "",
    weekdaysOnly:  template?.weekdaysOnly      ?? false,
    dayOfWeek:     template?.dayOfWeek?.toString() ?? "5",
    startTime:     template?.startTime         ?? "18:00",
    endTime:       template?.endTime           ?? "02:00",
    requiredCount: template?.requiredCount?.toString() ?? "2",
    role:          template?.role              ?? "",
    pay:           template?.pay?.toString()   ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url    = template ? `/api/shifts/templates/${template.id}` : "/api/shifts/templates";
    const method = template ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId,
        name:          form.name,
        weekdaysOnly:  form.weekdaysOnly,
        dayOfWeek:     form.weekdaysOnly ? null : Number(form.dayOfWeek),
        startTime:     form.startTime,
        endTime:       form.endTime,
        requiredCount: Number(form.requiredCount) || 1,
        role:          form.role  || undefined,
        pay:           form.pay   ? Number(form.pay) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">{template ? "Uredi šablon" : "Novi šablon"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naziv šablona *</label>
            <input type="text" required value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="npr. Petkom naveče" className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Dani</label>
            <button type="button"
              onClick={() => set("weekdaysOnly", !form.weekdaysOnly)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.weekdaysOnly ? "border-orange-400 bg-orange-50 text-orange-700" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"}`}>
              {form.weekdaysOnly ? "Radni dani (Pon–Pet)" : "Jedan dan u nedelji →"}
            </button>
            {!form.weekdaysOnly && (
              <select value={form.dayOfWeek} onChange={e => set("dayOfWeek", e.target.value)} className="auth-input mt-2">
                {DAYS_FULL_SR.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od *</label>
              <input type="time" required value={form.startTime} onChange={e => set("startTime", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do *</label>
              <input type="time" required value={form.endTime} onChange={e => set("endTime", e.target.value)} className="auth-input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Broj ljudi</label>
            <input type="number" min={1} max={20} value={form.requiredCount} onChange={e => set("requiredCount", e.target.value)} className="auth-input" />
          </div>
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={saving} className="btn-dash-orange py-2.5 disabled:opacity-60">
            {saving ? "Čuvanje..." : (template ? "Sačuvaj" : "Dodaj šablon")}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Generate modal ──────────────────────────────────────────────────────── */

export function GenerateModal({ template, onDone, onClose }: {
  template: ShiftTemplate;
  onDone: (created: number, skipped: number) => void;
  onClose: () => void;
}) {
  const today    = new Date().toISOString().slice(0, 10);
  const fourWeeks = new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(fourWeeks);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError]       = useState("");

  async function handleGenerate() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/shifts/templates/${template.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    const data = await res.json();
    setResult(data);
    onDone(data.created, data.skipped);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">Generiši smene</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <div className="bg-neutral-50 rounded-xl p-3">
          <div className="font-semibold text-neutral-800 text-sm">{template.name}</div>
          <div className="text-xs text-neutral-400 mt-0.5">
            {template.weekdaysOnly ? "Radni dani (Pon–Pet)" : DAYS_FULL_SR[template.dayOfWeek ?? 0]} · {template.startTime}–{template.endTime} · {template.requiredCount} {template.requiredCount === 1 ? "osoba" : "osobe"}
          </div>
        </div>
        {result ? (
          <div className="text-center py-4">
            <div className="text-2xl font-black text-green-600">{result.created}</div>
            <div className="text-sm text-neutral-500">smena kreirano</div>
            {result.skipped > 0 && <div className="text-xs text-neutral-400 mt-1">{result.skipped} preskočeno (već postoje)</div>}
            <button onClick={onClose} className="btn-dash-orange px-6 py-2 mt-4">Zatvori</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od datuma</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="auth-input" />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do datuma</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="auth-input" />
              </div>
            </div>
            {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
            <button onClick={handleGenerate} disabled={loading} className="btn-dash-orange py-2.5 disabled:opacity-60">
              {loading ? "Generišem..." : "Generiši smene"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

