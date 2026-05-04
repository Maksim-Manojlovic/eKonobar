"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Venue = { id: string; name: string };

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

export default function NewJobPostPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [venues, setVenues]     = useState<Venue[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [venueId, setVenueId]           = useState("");
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [engagementType, setEngType]    = useState("FULL_TIME");
  const [tipSystem, setTipSystem]       = useState("INDIVIDUAL");
  const [tipDescription, setTipDesc]    = useState("");
  const [salaryMin, setSalaryMin]       = useState("");
  const [salaryMax, setSalaryMax]       = useState("");
  const [sanitaryRequired, setSanitary] = useState(false);
  const [redAlert, setRedAlert]         = useState(false);
  const [redAlertNote, setAlertNote]    = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "VENUE_OWNER") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/venues")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setVenues(d);
          setVenueId(d[0].id);
        }
        setLoading(false);
      });
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId || !title || !description) {
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
          venueId,
          title,
          description,
          engagementType,
          tipSystem,
          tipDescription: tipDescription || null,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
          sanitaryRequired,
          redAlert,
          redAlertNote: redAlert ? (redAlertNote || null) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      router.push("/venue/jobs");
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
          <h1 className="text-2xl font-black text-neutral-900">Novi oglas za posao</h1>
        </div>

        <form onSubmit={handleSubmit} className="dash-card p-6 flex flex-col gap-5">

          {venues.length > 1 && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Lokal *</label>
              <select value={venueId} onChange={e => setVenueId(e.target.value)} className="auth-input bg-white">
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Naslov oglasa *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="auth-input" placeholder="npr. Senior Konobar" required />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Opis *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              className="auth-input resize-none" placeholder="Opis posla, zahtevi, radni uslovi..." required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Tip angažmana</label>
              <select value={engagementType} onChange={e => setEngType(e.target.value)} className="auth-input bg-white">
                {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Sistem napojnica</label>
              <select value={tipSystem} onChange={e => setTipSystem(e.target.value)} className="auth-input bg-white">
                {TIP_SYSTEMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {tipSystem !== "NO_TIPS" && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Opis napojnica</label>
              <input value={tipDescription} onChange={e => setTipDesc(e.target.value)} className="auth-input"
                placeholder="npr. Prosečno 20-30% od računa..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">
                Plata od (RSD/{engagementType === "FULL_TIME" ? "mes" : "sm"})
              </label>
              <input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} type="number" min="0" className="auth-input" placeholder="npr. 80000" />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">
                Plata do (RSD/{engagementType === "FULL_TIME" ? "mes" : "sm"})
              </label>
              <input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} type="number" min="0" className="auth-input" placeholder="npr. 100000" />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-700">Sanitarna knjižica obavezna</p>
                <p className="text-xs text-neutral-400">Konobar mora imati validnu sanitarnu knjižicu</p>
              </div>
              <button type="button" onClick={() => setSanitary(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${sanitaryRequired ? "bg-green-500" : "bg-neutral-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sanitaryRequired ? "translate-x-5" : ""}`} />
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
              <button type="button" onClick={() => setRedAlert(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${redAlert ? "bg-orange-500" : "bg-neutral-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${redAlert ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          {redAlert && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1 block">Napomena za Red Alert</label>
              <input value={redAlertNote} onChange={e => setAlertNote(e.target.value)} className="auth-input"
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
      </div>
    </div>
  );
}
