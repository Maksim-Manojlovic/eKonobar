"use client";

import { useState } from "react";

// ─── Category definitions ────────────────────────────────────────────────────

const WAITER_TO_VENUE_CATS = [
  { key: "ratingAtmosphere",   label: "Radna atmosfera" },
  { key: "ratingOrganization", label: "Organizacija smena" },
  { key: "ratingPay",          label: "Redovnost isplate" },
  { key: "ratingTips",         label: "Sistem podele bakšiša" },
  { key: "ratingHygieneWork",  label: "Higijenske uslove" },
  { key: "ratingManagement",   label: "Komunikacija menadžmenta" },
] as const;

const VENUE_TO_WAITER_CATS = [
  { key: "ratingPunctuality",        label: "Tačnost i pouzdanost" },
  { key: "ratingSkill",              label: "Profesionalne veštine" },
  { key: "ratingGuestCommunication", label: "Komunikacija sa gostima" },
  { key: "ratingPersonalHygiene",    label: "Lična higijena" },
  { key: "ratingTeamwork",           label: "Timski rad" },
  { key: "ratingSpeed",              label: "Brzina usluge" },
] as const;

const GUEST_TO_WAITER_CATS = [
  { key: "ratingFriendliness",  label: "Ljubaznost" },
  { key: "ratingGuestSpeed",    label: "Brzina usluge" },
  { key: "ratingAttentiveness", label: "Pažljivost" },
] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

export type ReviewDirection = "WAITER_TO_VENUE" | "VENUE_TO_WAITER" | "GUEST_TO_WAITER";

export interface ReviewWizardProps {
  direction: ReviewDirection;
  venueId?: string;
  venueName?: string;
  subjectId?: string;
  subjectName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ─── Star rating input ────────────────────────────────────────────────────────

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="text-2xl transition-transform hover:scale-110 focus:outline-none"
        >
          <span className={(hover || value) >= n ? "text-amber-400" : "text-neutral-200"}>★</span>
        </button>
      ))}
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function ReviewWizard({
  direction,
  venueId,
  venueName,
  subjectId,
  subjectName,
  onSuccess,
  onCancel,
}: ReviewWizardProps) {
  const isGuest = direction === "GUEST_TO_WAITER";
  const totalSteps = isGuest ? 3 : 2;

  const cats =
    direction === "WAITER_TO_VENUE" ? WAITER_TO_VENUE_CATS :
    direction === "VENUE_TO_WAITER" ? VENUE_TO_WAITER_CATS :
                                      GUEST_TO_WAITER_CATS;

  const [step, setStep]       = useState<number>(isGuest ? 0 : 1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [locErr, setLocErr]   = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords]   = useState<{ lat: number; lon: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Step 0: geolocation (GUEST only) ───────────────────────────────────────
  async function requestLocation() {
    setLocating(true);
    setLocErr(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10_000 }),
      );
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setStep(1);
    } catch {
      setLocErr("Lokacija nije dostupna. Proveri dozvole u pretrazivaču.");
    } finally {
      setLocating(false);
    }
  }

  // ── Overall rating = average of category ratings ────────────────────────────
  function computeOverall(): number {
    const vals = Object.values(ratings).filter(Boolean);
    if (!vals.length) return 0;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 20); // 1-5 → 0-100
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        direction,
        venueId,
        subjectId,
        overallRating: computeOverall(),
        comment: comment.trim() || null,
        ...Object.fromEntries(
          Object.entries(ratings).map(([k, v]) => [k, Math.round(v * 20)]),
        ),
      };

      if (isGuest && coords) {
        payload.guestLatitude  = coords.lat;
        payload.guestLongitude = coords.lon;
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Greška pri slanju recenzije");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neočekivana greška");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Title ───────────────────────────────────────────────────────────────────
  const targetLabel =
    direction === "WAITER_TO_VENUE" ? (venueName ?? "lokal") :
    direction === "VENUE_TO_WAITER" ? (subjectName ?? "konobara") :
                                       (subjectName ?? "konobara");

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="dash-card p-6 max-w-md w-full flex flex-col gap-5">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i + (isGuest ? 0 : 1) === step ? "active" : i + (isGuest ? 0 : 1) < step ? "done" : ""}`}
          />
        ))}
        <span className="ml-auto text-xs text-neutral-400 font-medium">
          {step + (isGuest ? 1 : 0)}/{totalSteps}
        </span>
      </div>

      {/* ── Step 0: Geolocation ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex flex-col gap-4 text-center">
          <div className="text-4xl">📍</div>
          <h3 className="font-black text-lg text-neutral-900">Potvrdi lokaciju</h3>
          <p className="text-sm text-neutral-500">
            Da bismo verifikovali da si u lokalu, potrebna je tvoja lokacija.
          </p>
          {locErr && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{locErr}</p>}
          <button
            onClick={requestLocation}
            disabled={locating}
            className="btn-dash-orange py-3 disabled:opacity-50"
          >
            {locating ? "Učitavam..." : "Dozvoli lokaciju"}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-600">
              Otkaži
            </button>
          )}
        </div>
      )}

      {/* ── Step 1: Category ratings ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">
              {direction === "WAITER_TO_VENUE" ? "Recenzija lokala" :
               direction === "VENUE_TO_WAITER" ? "Recenzija konobara" : "Recenzija konobara"}
            </p>
            <h3 className="font-black text-lg text-neutral-900">{targetLabel}</h3>
          </div>

          <div className="flex flex-col gap-3">
            {cats.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-neutral-700 flex-1">{label}</span>
                <StarInput
                  value={ratings[key] ?? 0}
                  onChange={(v) => setRatings((r) => ({ ...r, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            {onCancel && (
              <button onClick={onCancel} className="btn-dash-outline flex-1 py-2.5">
                Otkaži
              </button>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={Object.keys(ratings).length < cats.length}
              className="btn-dash-orange flex-1 py-2.5 disabled:opacity-40"
            >
              Dalje →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Comment + submit ──────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">Komentar</p>
            <h3 className="font-black text-lg text-neutral-900">Dodaj komentar</h3>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Podeli iskustvo... (opciono)"
            rows={4}
            className="auth-input resize-none"
          />

          {/* Score preview */}
          <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-neutral-600">Ukupna ocena</span>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">{"★".repeat(Math.round(computeOverall() / 20))}</span>
              <span className="text-sm font-black text-neutral-900">{computeOverall()}/100</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="btn-dash-outline flex-1 py-2.5"
            >
              ← Nazad
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-dash-orange flex-1 py-2.5 disabled:opacity-50"
            >
              {submitting ? "Šaljem..." : "Pošalji recenziju"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
