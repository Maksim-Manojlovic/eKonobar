"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Waiter = { id: string; name: string | null; image: string | null };
type VenueInfo = {
  id: string; name: string; address: string | null;
  latitude: number | null; longitude: number | null; reviewRadiusKm: number | null;
  geofenceEnabled: boolean;
  images: string[];
};

type Step =
  | "loading" | "error" | "choose"
  | "select" | "rate" | "rate-venue"
  | "comment" | "submitting" | "done" | "geo-denied";

type Mode = "waiter" | "venue" | "both";

function StarRow({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-600 min-w-0 flex-1">{label}</span>
      <div className="flex gap-1 flex-shrink-0">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="text-2xl leading-none transition-transform active:scale-90"
            style={{ color: n <= (hover || value) ? "#f97316" : "#d1d5db" }}>
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function BigStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="text-4xl leading-none transition-transform active:scale-90"
          style={{ color: n <= value ? "#f97316" : "#d1d5db" }}>
          ★
        </button>
      ))}
    </div>
  );
}

const LABELS = ["", "Loše", "Može bolje", "Solidno", "Dobro", "Odlično"];

export default function GuestReviewPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const [step, setStep]       = useState<Step>("loading");
  const [mode, setMode]       = useState<Mode>("waiter");
  const [venue, setVenue]     = useState<VenueInfo | null>(null);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selected, setSelected] = useState<Waiter | null>(null);

  // Waiter rating state
  const [overall, setOverall]     = useState(0);
  const [friendly, setFriendly]   = useState(0);
  const [speed, setSpeed]         = useState(0);
  const [attentive, setAttentive] = useState(0);

  // Venue rating state
  const [venueAtm, setVenueAtm] = useState(0);
  const [venueOrg, setVenueOrg] = useState(0);
  const [venueHyg, setVenueHyg] = useState(0);

  const [comment, setComment]   = useState("");
  const [handle, setHandle]     = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/venues/${venueId}/public`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStep("error"); return; }
        setVenue(data.venue);
        setWaiters(data.waiters);
        setStep("choose");
      })
      .catch(() => setStep("error"));
  }, [venueId]);

  async function resolveCoords(): Promise<{ lat: number; lon: number } | null> {
    if (!venue?.geofenceEnabled) return null;
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(null),
        { timeout: 10000, maximumAge: 0 },
      );
    });
  }

  async function handleSubmit() {
    setStep("submitting");
    setErrorMsg("");

    let guestLatitude: number | undefined;
    let guestLongitude: number | undefined;

    if (venue?.geofenceEnabled) {
      const coords = await resolveCoords();
      if (!coords) { setStep("geo-denied"); return; }
      guestLatitude  = coords.lat;
      guestLongitude = coords.lon;
    }

    const base = {
      venueId,
      guestHandle:    handle   || undefined,
      comment:        comment  || undefined,
      guestLatitude,
      guestLongitude,
    };

    if (mode === "waiter" || mode === "both") {
      const res = await fetch("/api/reviews/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...base,
          direction:           "GUEST_TO_WAITER",
          subjectId:           selected!.id,
          overallRating:       overall   * 20,
          ratingFriendliness:  friendly  ? friendly  * 20 : undefined,
          ratingGuestSpeed:    speed     ? speed     * 20 : undefined,
          ratingAttentiveness: attentive ? attentive * 20 : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg((d as { error?: string }).error ?? "Greška. Pokušajte ponovo.");
        setStep("comment");
        return;
      }
    }

    if (mode === "venue" || mode === "both") {
      const dims = [venueAtm, venueOrg, venueHyg].filter(v => v > 0).map(v => v * 20);
      const venueOverall = dims.length > 0
        ? Math.round(dims.reduce((a, b) => a + b) / dims.length)
        : venueAtm * 20;

      const res = await fetch("/api/reviews/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...base,
          direction:          "GUEST_TO_VENUE",
          overallRating:      venueOverall,
          ratingAtmosphere:   venueAtm ? venueAtm * 20 : undefined,
          ratingOrganization: venueOrg ? venueOrg * 20 : undefined,
          ratingHygieneWork:  venueHyg ? venueHyg * 20 : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg((d as { error?: string }).error ?? "Greška. Pokušajte ponovo.");
        setStep("comment");
        return;
      }
    }

    setStep("done");
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-orange-50/30 flex flex-col">
      <div className="flex-shrink-0 px-5 pt-6 pb-4 border-b border-neutral-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-black text-sm">e</div>
          <div>
            <div className="text-xs text-neutral-400 font-medium">eKonobar · Recenzija gosta</div>
            {venue && <div className="text-sm font-bold text-neutral-800 leading-tight">{venue.name}</div>}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-6">
        {children}
      </div>
    </div>
  );

  const BackArrow = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="text-neutral-400 hover:text-neutral-600 flex-shrink-0">
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );

  // ── Steps ──────────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      </Shell>
    );
  }

  if (step === "error") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <div className="text-4xl">😕</div>
          <div className="font-bold text-neutral-800">Lokal nije pronađen</div>
          <div className="text-sm text-neutral-500">Proverite QR kod ili kontaktirajte osoblje lokala.</div>
        </div>
      </Shell>
    );
  }

  if (step === "done") {
    const doneMsg =
      mode === "both"   ? "Obe recenzije su primljene i biće objavljene unutar 2 sata." :
      mode === "venue"  ? "Ocena lokala je primljena i biće objavljena unutar 2 sata." :
                          "Recenzija je primljena i biće objavljena unutar 2 sata.";
    const helperMsg =
      mode === "both"  ? `Hvala na kompletnoj oceni lokala ${venue?.name ?? ""}.` :
      mode === "venue" ? `Vaša ocena pomaže ${venue?.name ?? "lokalu"} da gradi reputaciju.` :
                         `Vaša ocena pomaže ${selected?.name ?? "konobaru"} da gradi digitalni pasoš.`;
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="font-black text-xl text-neutral-900">Hvala na oceni!</div>
          <div className="text-sm text-neutral-500">{doneMsg}</div>
          <div className="text-xs text-neutral-400 mt-2">{helperMsg}</div>
        </div>
      </Shell>
    );
  }

  if (step === "geo-denied") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-4xl">📍</div>
          <div className="font-bold text-neutral-800">Lokacija je obavezna</div>
          <div className="text-sm text-neutral-500">
            Gostinske recenzije zahtevaju potvrdu da se nalazite u lokalu. Dozvolite pristup lokaciji u postavkama pretraživača i pokušajte ponovo.
          </div>
          <button onClick={() => setStep("comment")}
            className="mt-2 px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm">
            Pokušaj ponovo
          </button>
        </div>
      </Shell>
    );
  }

  // ── Choose ─────────────────────────────────────────────────────────────────
  if (step === "choose") {
    const hasWaiters = waiters.length > 0;
    return (
      <Shell>
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-xl font-black text-neutral-900">Šta želite da ocenite?</h1>
            <p className="text-sm text-neutral-500 mt-1">Izaberite vrstu recenzije.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setMode("venue"); setStep("rate-venue"); }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 active:scale-95 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-neutral-900">Oceni restoran</div>
                <div className="text-xs text-neutral-500 mt-0.5">Atmosfera, usluga, čistoća</div>
              </div>
              <svg className="flex-shrink-0 text-neutral-300" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
            </button>

            {hasWaiters && (
              <button
                onClick={() => { setMode("waiter"); setStep("select"); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 active:scale-95 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-900">Oceni konobara</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Ko vas je uslužio danas?</div>
                </div>
                <svg className="flex-shrink-0 text-neutral-300" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            )}

            {hasWaiters && (
              <button
                onClick={() => { setMode("both"); setStep("select"); }}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-orange-200 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 active:scale-95 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white text-2xl flex-shrink-0">⭐</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-900">Oceni oba</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Kompletno iskustvo — restoran i konobar</div>
                </div>
                <svg className="flex-shrink-0 text-neutral-300" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Select waiter ──────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <Shell>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <BackArrow onClick={() => setStep("choose")} />
            <div>
              <h1 className="text-xl font-black text-neutral-900">Ko vas je uslužio?</h1>
              {mode === "both" && <p className="text-xs text-orange-500 font-semibold mt-0.5">Korak 1 od 2</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {waiters.map(w => (
              <button key={w.id} onClick={() => { setSelected(w); setStep("rate"); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 active:scale-95 transition-all">
                {w.image ? (
                  <img src={w.image} alt={w.name ?? ""} className="w-14 h-14 rounded-full object-cover ring-2 ring-neutral-100" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-black text-xl">
                    {(w.name ?? "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-neutral-800 text-center leading-tight">{w.name ?? "Konobar"}</span>
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Rate waiter ────────────────────────────────────────────────────────────
  if (step === "rate") {
    const canContinue = overall > 0;
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <BackArrow onClick={() => setStep("select")} />
            <div>
              <h1 className="text-xl font-black text-neutral-900">Ocenite konobara</h1>
              <p className="text-sm text-neutral-500">{selected?.name ?? "Konobar"}{mode === "both" && " · Korak 1 od 2"}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-neutral-100 flex flex-col items-center gap-2">
            <div className="text-sm font-semibold text-neutral-500">Opšta ocena *</div>
            <BigStars value={overall} onChange={setOverall} />
            {overall > 0 && <div className="text-xs text-orange-500 font-semibold">{LABELS[overall]}</div>}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex flex-col gap-4">
            <div className="text-xs font-black text-neutral-400 uppercase tracking-wider">Detalji (opciono)</div>
            <StarRow label="Ljubaznost"  value={friendly}  onChange={setFriendly} />
            <StarRow label="Brzina"      value={speed}     onChange={setSpeed} />
            <StarRow label="Pažljivost"  value={attentive} onChange={setAttentive} />
          </div>

          <button
            onClick={() => setStep(mode === "both" ? "rate-venue" : "comment")}
            disabled={!canContinue}
            className="py-3.5 rounded-2xl bg-orange-500 text-white font-black text-base disabled:opacity-40 active:scale-95 transition-all">
            {mode === "both" ? "Dalje — oceni restoran" : "Dalje"}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Rate venue ─────────────────────────────────────────────────────────────
  if (step === "rate-venue") {
    const canContinue = venueAtm > 0;
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <BackArrow onClick={() => setStep(mode === "both" ? "rate" : "choose")} />
            <div>
              <h1 className="text-xl font-black text-neutral-900">Ocenite lokal</h1>
              {mode === "both" && <p className="text-sm text-neutral-500">Korak 2 od 2</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-neutral-100 flex flex-col items-center gap-2">
            <div className="text-sm font-semibold text-neutral-500">Atmosfera i ambijent *</div>
            <BigStars value={venueAtm} onChange={setVenueAtm} />
            {venueAtm > 0 && <div className="text-xs text-orange-500 font-semibold">{LABELS[venueAtm]}</div>}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex flex-col gap-4">
            <div className="text-xs font-black text-neutral-400 uppercase tracking-wider">Detalji (opciono)</div>
            <StarRow label="Kvalitet usluge" value={venueOrg} onChange={setVenueOrg} />
            <StarRow label="Čistoća"         value={venueHyg} onChange={setVenueHyg} />
          </div>

          <button
            onClick={() => setStep("comment")}
            disabled={!canContinue}
            className="py-3.5 rounded-2xl bg-orange-500 text-white font-black text-base disabled:opacity-40 active:scale-95 transition-all">
            Dalje
          </button>
        </div>
      </Shell>
    );
  }

  // ── Comment ────────────────────────────────────────────────────────────────
  if (step === "comment" || step === "submitting") {
    const backStep: Step = mode === "waiter" ? "rate" : "rate-venue";
    return (
      <Shell>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <BackArrow onClick={() => { if (step !== "submitting") setStep(backStep); }} />
            <h1 className="text-xl font-black text-neutral-900">Komentar</h1>
          </div>

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Podelite iskustvo (opciono)..."
            rows={4}
            maxLength={1000}
            disabled={step === "submitting"}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400 resize-none disabled:opacity-60"
          />

          <div>
            <label className="text-xs font-semibold text-neutral-500 mb-1.5 block">Vaše ime ili nadimak (opciono)</label>
            <input
              type="text"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="npr. Marko"
              maxLength={50}
              disabled={step === "submitting"}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>

          {errorMsg && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          {venue?.geofenceEnabled && (
            <div className="text-xs text-neutral-400 bg-neutral-50 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Pritiskom na dugme dozvolićete pristup lokaciji radi potvrde da se nalazite u lokalu. Recenzija se objavljuje za 2 sata.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={step === "submitting"}
            className="py-3.5 rounded-2xl bg-orange-500 text-white font-black text-base disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2">
            {step === "submitting" ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {venue?.geofenceEnabled ? "Proveravamo lokaciju..." : "Šaljemo..."}
              </>
            ) : "Pošalji recenziju"}
          </button>
        </div>
      </Shell>
    );
  }

  return null;
}
