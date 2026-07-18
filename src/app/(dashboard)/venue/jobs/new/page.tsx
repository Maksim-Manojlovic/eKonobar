"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWaiterSearch } from "@/hooks/useWaiterSearch";
import { WaiterCard, type WaiterCardData } from "@/components/ui/WaiterCard";

type Venue = { id: string; name: string; municipality: string };

const ENGAGEMENT_TYPES = [
  { value: "FULL_TIME",    label: "Stalno" },
  { value: "SEASONAL",     label: "Sezonski" },
  { value: "WEEKEND",      label: "Vikend" },
  { value: "CELEBRATION",  label: "Slavlje/Proslava" },
];

const TIP_SYSTEMS = [
  { value: "INDIVIDUAL",   label: "Individualni" },
  { value: "SHARED",       label: "Podeljeni" },
  { value: "VENUE_POLICY", label: "Po politici lokala" },
  { value: "NO_TIPS",      label: "Bez napojnica" },
];

/** Grouped form state (CQ-N pattern) — one source of truth for all editable fields. */
type JobPostForm = {
  venueId: string;
  title: string;
  description: string;
  engagementType: string;
  tipSystem: string;
  tipDescription: string;
  salaryMin: string;
  salaryMax: string;
  sanitaryRequired: boolean;
  redAlert: boolean;
  redAlertNote: string;
};

const INITIAL_FORM: JobPostForm = {
  venueId: "",
  title: "",
  description: "",
  engagementType: "FULL_TIME",
  tipSystem: "INDIVIDUAL",
  tipDescription: "",
  salaryMin: "",
  salaryMax: "",
  sanitaryRequired: false,
  redAlert: false,
  redAlertNote: "",
};

import { useRequireRole } from "@/hooks/useRequireRole";
export default function NewJobPostPage() {
  const { status } = useRequireRole("VENUE_OWNER");
  const router = useRouter();

  const [venues, setVenues]   = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState<JobPostForm>(INITIAL_FORM);
  const setField = <K extends keyof JobPostForm>(k: K, v: JobPostForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // After a successful post: switch to the reachable-waiter suggestions instead of
  // navigating away, so the owner can invite the right people in one step.
  const [posted, setPosted] = useState<{ jobId: string; municipality: string } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/venues")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setVenues(d);
          setField("venueId", d[0].id);
        }
        setLoading(false);
      });
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.venueId || !form.title || !form.description) {
      setError("Lokal, naslov i opis su obavezni.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: form.venueId,
          title: form.title,
          description: form.description,
          engagementType: form.engagementType,
          tipSystem: form.tipSystem,
          tipDescription: form.tipDescription || null,
          salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
          salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
          sanitaryRequired: form.sanitaryRequired,
          redAlert: form.redAlert,
          redAlertNote: form.redAlert ? (form.redAlertNote || null) : null,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error ?? "Greška");
      const venue = venues.find(v => v.id === form.venueId);
      // Suggest reachable waiters for the venue's opština; fall back to navigating
      // if we somehow lack the municipality (older venue rows).
      if (venue?.municipality) {
        setPosted({ jobId: created.id, municipality: venue.municipality });
      } else {
        router.push("/venue/jobs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/venue/jobs" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Oglasi</Link>
          </div>
          <h1 className="text-2xl font-black text-neutral-900">
            {posted ? "Oglas objavljen!" : "Novi oglas za posao"}
          </h1>
        </div>

        {posted ? (
          <ReachSuggestions
            jobId={posted.jobId}
            municipality={posted.municipality}
            onDone={() => router.push("/venue/jobs")}
          />
        ) : (
        <form onSubmit={handleSubmit} className="dash-card p-6 flex flex-col gap-5">

          {venues.length > 1 && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Lokal *</label>
              <select value={form.venueId} onChange={e => setField("venueId", e.target.value)} className="auth-input bg-white">
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Naslov oglasa *</label>
            <input value={form.title} onChange={e => setField("title", e.target.value)} className="auth-input" placeholder="npr. Senior Konobar" required />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Opis *</label>
            <textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={4}
              className="auth-input resize-none" placeholder="Opis posla, zahtevi, radni uslovi..." required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Tip angažmana</label>
              <select value={form.engagementType} onChange={e => setField("engagementType", e.target.value)} className="auth-input bg-white">
                {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Sistem napojnica</label>
              <select value={form.tipSystem} onChange={e => setField("tipSystem", e.target.value)} className="auth-input bg-white">
                {TIP_SYSTEMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {form.tipSystem !== "NO_TIPS" && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Opis napojnica</label>
              <input value={form.tipDescription} onChange={e => setField("tipDescription", e.target.value)} className="auth-input"
                placeholder="npr. Prosečno 20-30% od računa..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">
                Plata od (RSD/{form.engagementType === "FULL_TIME" ? "mes" : "sm"})
              </label>
              <input value={form.salaryMin} onChange={e => setField("salaryMin", e.target.value)} type="number" min="0" className="auth-input" placeholder="npr. 80000" />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">
                Plata do (RSD/{form.engagementType === "FULL_TIME" ? "mes" : "sm"})
              </label>
              <input value={form.salaryMax} onChange={e => setField("salaryMax", e.target.value)} type="number" min="0" className="auth-input" placeholder="npr. 100000" />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-700">Sanitarna knjižica obavezna</p>
                <p className="text-xs text-neutral-400">Konobar mora imati validnu sanitarnu knjižicu</p>
              </div>
              <button type="button" onClick={() => setField("sanitaryRequired", !form.sanitaryRequired)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.sanitaryRequired ? "bg-green-500" : "bg-neutral-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.sanitaryRequired ? "translate-x-5" : ""}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">⚡ RED ALERT</span>
                  Hitni angažman
                </p>
                <p className="text-xs text-neutral-400">Oglas se prikazuje kao prioritetan</p>
              </div>
              <button type="button" onClick={() => setField("redAlert", !form.redAlert)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.redAlert ? "bg-orange-500" : "bg-neutral-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.redAlert ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          {form.redAlert && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Napomena za Red Alert</label>
              <input value={form.redAlertNote} onChange={e => setField("redAlertNote", e.target.value)} className="auth-input"
                placeholder="npr. Potreban odmah ovog vikenda!" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Link href="/venue/jobs" className="btn-dash-outline flex-1 py-2.5 text-center text-sm">Otkaži</Link>
            <button type="submit" disabled={saving} className="btn-dash-orange flex-1 py-2.5 disabled:opacity-50 text-sm">
              {saving ? "Kreiram..." : "Kreiraj oglas"}
            </button>
          </div>

        </form>
        )}
      </div>
    </div>
  );
}

/**
 * Reverse discovery (B4 Part 1): right after a post is created, surface the
 * available waiters whose declared reach covers the venue's opština, each with a
 * one-tap invite. Reuses the shared waiter search + card so this stays in sync
 * with the venue Discover surface.
 */
function ReachSuggestions({ jobId, municipality, onDone }: {
  jobId: string;
  municipality: string;
  onDone: () => void;
}) {
  const { waiters, isLoading } = useWaiterSearch<WaiterCardData>({ municipality, available: true });
  const [invited, setInvited] = useState<Record<string, "sending" | "done" | "error">>({});

  async function invite(waiterId: string) {
    setInvited(p => ({ ...p, [waiterId]: "sending" }));
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId, jobPostId: jobId }),
    });
    // 409 = already invited for this post — treat as done, not an error.
    setInvited(p => ({ ...p, [waiterId]: res.ok || res.status === 409 ? "done" : "error" }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="dash-card p-5">
        <p className="text-sm font-bold text-neutral-900">
          Konobari koji rade u opštini {municipality}
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">
          Dostupni konobari iz tvoje opštine — pozovi ih direktno na ovaj oglas.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map(i => <div key={i} className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : waiters.length === 0 ? (
        <div className="dash-card p-8 text-center text-sm text-neutral-400">
          Trenutno nema dostupnih konobara u ovoj opštini. Oglas je i dalje objavljen.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {waiters.map(w => {
            const state = invited[w.id];
            return (
              <WaiterCard
                key={w.id}
                waiter={w}
                actions={
                  <button
                    onClick={() => invite(w.id)}
                    disabled={state === "sending" || state === "done"}
                    className="btn-dash-orange flex-1 py-1.5 text-xs disabled:opacity-60"
                  >
                    {state === "done" ? "Pozvan ✓"
                      : state === "sending" ? "Šaljem..."
                      : state === "error" ? "Pokušaj opet"
                      : "Pozovi"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}

      <button onClick={onDone} className="btn-dash-outline py-2.5 text-sm self-start px-6">
        Gotovo →
      </button>
    </div>
  );
}
