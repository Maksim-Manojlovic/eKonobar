"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

type Venue = {
  id: string; name: string; address?: string | null;
  geofenceEnabled: boolean; reviewRadiusKm?: number | null;
  images: string[];
};
type Waiter = { id: string; name?: string | null; image?: string | null };
type Coords = { lat: number; lon: number };
type Step = "loading" | "error404" | "choose" | "venue" | "waiter" | "both-venue" | "both-waiter" | "success";

function toApi(stars: number) { return Math.round((stars / 5) * 100); }

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHovered(i)}
          onClick={() => onChange(i)}
          className={`text-3xl transition-colors leading-none ${
            i <= (hovered || value) ? "text-amber-400" : "text-neutral-200"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function WaiterAvatar({ waiter }: { waiter: Waiter }) {
  const initials = waiter.name
    ? waiter.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  return waiter.image ? (
    <img src={waiter.image} alt={waiter.name ?? ""} className="w-9 h-9 rounded-full object-cover border-2 border-orange-200 flex-shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center border-2 border-orange-200 flex-shrink-0">
      {initials}
    </div>
  );
}

export default function GuestReviewPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [step, setStep]       = useState<Step>("loading");
  const [venue, setVenue]     = useState<Venue | null>(null);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [coords, setCoords]   = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Shared form state
  const [guestHandle, setGuestHandle]     = useState("");
  const [venueAtmo, setVenueAtmo]         = useState(0);
  const [venueOrg, setVenueOrg]           = useState(0);
  const [venueHyg, setVenueHyg]           = useState(0);
  const [venueComment, setVenueComment]   = useState("");
  const [waiterId, setWaiterId]           = useState("");
  const [wFriendly, setWFriendly]         = useState(0);
  const [wSpeed, setWSpeed]               = useState(0);
  const [wAttn, setWAttn]                 = useState(0);
  const [waiterComment, setWaiterComment] = useState("");

  useEffect(() => {
    fetch(`/api/venues/${venueId}/public`)
      .then(async (r) => {
        if (r.status === 404) { setStep("error404"); return; }
        const d = await r.json();
        setVenue(d.venue);
        setWaiters(d.waiters ?? []);
        setStep("choose");
      })
      .catch(() => setStep("error404"));
  }, [venueId]);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoError("Geolokacija nije podržana"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setGeoError("Pristup lokaciji odbijen"),
      { timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (step === "choose") getLocation();
  }, [step, getLocation]);

  async function postReview(body: Record<string, unknown>) {
    const res = await fetch("/api/reviews/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        venueId,
        guestHandle: guestHandle.trim() || undefined,
        ...(coords ? { guestLatitude: coords.lat, guestLongitude: coords.lon } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Greška pri slanju");
  }

  async function submitVenue(nextStep: "success" | "both-waiter") {
    if (!venueAtmo || !venueOrg || !venueHyg) { setApiError("Ocenite sve kategorije"); return; }
    const avg = toApi(Math.round((venueAtmo + venueOrg + venueHyg) / 3));
    setSubmitting(true); setApiError(null);
    try {
      await postReview({
        direction: "GUEST_TO_VENUE",
        overallRating: avg,
        comment: venueComment.trim() || undefined,
        ratingAtmosphere:   toApi(venueAtmo),
        ratingOrganization: toApi(venueOrg),
        ratingHygieneWork:  toApi(venueHyg),
      });
      setStep(nextStep);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Greška");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWaiter() {
    if (!waiterId) { setApiError("Izaberite konobara"); return; }
    if (!wFriendly || !wSpeed || !wAttn) { setApiError("Ocenite sve kategorije"); return; }
    const avg = toApi(Math.round((wFriendly + wSpeed + wAttn) / 3));
    setSubmitting(true); setApiError(null);
    try {
      await postReview({
        direction: "GUEST_TO_WAITER",
        subjectId: waiterId,
        overallRating: avg,
        comment: waiterComment.trim() || undefined,
        ratingFriendliness:  toApi(wFriendly),
        ratingGuestSpeed:    toApi(wSpeed),
        ratingAttentiveness: toApi(wAttn),
      });
      setStep("success");
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Greška");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (step === "error404") return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#fafaf8" }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🏪</p>
        <p className="font-black text-xl text-neutral-900">Lokal nije pronađen</p>
        <p className="text-neutral-400 mt-2 text-sm">Proverite QR kod i pokušajte ponovo.</p>
      </div>
    </div>
  );

  if (step === "success") return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#fafaf8" }}>
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">🎉</p>
        <p className="font-black text-2xl text-neutral-900 mb-2">Hvala na recenziji!</p>
        <p className="text-neutral-500 text-sm">
          Vaša ocena je primljena i biće objavljena nakon kratke provere.
        </p>
        <p className="text-neutral-400 text-xs mt-6">eKonobar — recenzije koje pomažu</p>
      </div>
    </div>
  );

  const card = "bg-white rounded-2xl border border-neutral-100 shadow-sm p-6";
  const input = "w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white";
  const label = "text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5 block";

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Venue header */}
        <div className="text-center">
          <p className="text-4xl mb-3">🍽️</p>
          <h1 className="font-black text-2xl text-neutral-900">{venue!.name}</h1>
          {venue!.address && <p className="text-sm text-neutral-400 mt-1">{venue!.address}</p>}
          {geoError && venue!.geofenceEnabled && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mt-3 inline-block">
              ⚠️ {geoError} — recenzija možda neće biti prihvaćena bez lokacije
            </p>
          )}
        </div>

        {/* Guest handle (global, shown once at top) */}
        <div className={card}>
          <label className={label}>Vaše ime (opciono)</label>
          <input
            value={guestHandle}
            onChange={(e) => setGuestHandle(e.target.value)}
            placeholder="Npr. Marko S. ili ostavi prazno"
            maxLength={50}
            className={input}
          />
        </div>

        {/* Step: choose */}
        {step === "choose" && (
          <div className={card}>
            <p className="font-black text-neutral-900 text-center mb-5 text-lg">Šta biste ocenili?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("venue")}
                className="w-full py-4 rounded-xl bg-orange-50 border-2 border-orange-200 text-orange-700 font-black text-sm hover:bg-orange-100 transition-all"
              >
                🏪 Oceni restoran / lokal
              </button>
              {waiters.length > 0 && (
                <button
                  onClick={() => setStep("waiter")}
                  className="w-full py-4 rounded-xl bg-orange-50 border-2 border-orange-200 text-orange-700 font-black text-sm hover:bg-orange-100 transition-all"
                >
                  👤 Oceni konobara
                </button>
              )}
              {waiters.length > 0 && (
                <button
                  onClick={() => setStep("both-venue")}
                  className="w-full py-4 rounded-xl bg-orange-500 text-white font-black text-sm hover:bg-orange-600 transition-all"
                >
                  ⭐ Oceni i restoran i konobara
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: venue review */}
        {(step === "venue" || step === "both-venue") && (
          <div className={card}>
            <p className="font-black text-neutral-900 mb-5">
              {step === "both-venue" ? "Korak 1 od 2 — " : ""}Ocena lokala
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className={label}>Atmosfera</label>
                <StarPicker value={venueAtmo} onChange={setVenueAtmo} />
              </div>
              <div>
                <label className={label}>Organizacija</label>
                <StarPicker value={venueOrg} onChange={setVenueOrg} />
              </div>
              <div>
                <label className={label}>Higijena</label>
                <StarPicker value={venueHyg} onChange={setVenueHyg} />
              </div>
              <div>
                <label className={label}>Komentar (opciono)</label>
                <textarea
                  value={venueComment}
                  onChange={(e) => setVenueComment(e.target.value)}
                  placeholder="Šta vam se dopalo ili nije dopalo?"
                  maxLength={1000}
                  rows={3}
                  className={input}
                />
              </div>
            </div>

            {apiError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setApiError(null); setStep("choose"); }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-bold hover:bg-neutral-50 transition-all"
              >
                Nazad
              </button>
              <button
                onClick={() => submitVenue(step === "both-venue" ? "both-waiter" : "success")}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-all disabled:opacity-60"
              >
                {submitting ? "Slanje..." : step === "both-venue" ? "Dalje →" : "Pošalji ocenu"}
              </button>
            </div>
          </div>
        )}

        {/* Step: waiter review */}
        {(step === "waiter" || step === "both-waiter") && (
          <div className={card}>
            <p className="font-black text-neutral-900 mb-5">
              {step === "both-waiter" ? "Korak 2 od 2 — " : ""}Ocena konobara
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className={label}>Izaberi konobara</label>
                <div className="flex flex-col gap-2">
                  {waiters.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWaiterId(w.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        waiterId === w.id
                          ? "border-orange-400 bg-orange-50"
                          : "border-neutral-200 hover:border-orange-200"
                      }`}
                    >
                      <WaiterAvatar waiter={w} />
                      <span className="font-bold text-sm text-neutral-900">{w.name ?? "Konobar"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={label}>Ljubaznost</label>
                <StarPicker value={wFriendly} onChange={setWFriendly} />
              </div>
              <div>
                <label className={label}>Brzina usluge</label>
                <StarPicker value={wSpeed} onChange={setWSpeed} />
              </div>
              <div>
                <label className={label}>Pažljivost</label>
                <StarPicker value={wAttn} onChange={setWAttn} />
              </div>
              <div>
                <label className={label}>Komentar (opciono)</label>
                <textarea
                  value={waiterComment}
                  onChange={(e) => setWaiterComment(e.target.value)}
                  placeholder="Šta vam se dopalo ili nije dopalo?"
                  maxLength={1000}
                  rows={3}
                  className={input}
                />
              </div>
            </div>

            {apiError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setApiError(null); setStep(step === "both-waiter" ? "both-venue" : "choose"); }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-bold hover:bg-neutral-50 transition-all"
              >
                Nazad
              </button>
              <button
                onClick={submitWaiter}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-all disabled:opacity-60"
              >
                {submitting ? "Slanje..." : "Pošalji ocenu"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-neutral-300 pb-4">
          Powered by <span className="font-bold">eKonobar</span>
        </p>
      </div>
    </div>
  );
}
