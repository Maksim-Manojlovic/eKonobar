"use client";

import { useState } from "react";

interface Props {
  venueId: string;
  venueName: string;
  isActive: boolean;
  onToggle: (newIsActive: boolean) => void;
}

export default function DeactivateVenueButton({ venueId, venueName, isActive, onToggle }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Greška pri promeni statusa");
      }
      setConfirming(false);
      onToggle(!isActive);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neočekivana greška");
    } finally {
      setLoading(false);
    }
  }

  if (!isActive) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-neutral-400">
          Lokal je trenutno <span className="font-bold text-red-500">neaktivan</span> i nije vidljiv na platformi.
        </p>
        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
        <button
          onClick={handleToggle}
          disabled={loading}
          className="btn-dash-orange py-2 px-4 text-sm w-fit disabled:opacity-50"
        >
          {loading ? "Aktiviram..." : "Aktiviraj lokal"}
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
        <p className="text-sm font-bold text-red-700">
          Deaktivirati <span className="font-black">&ldquo;{venueName}&rdquo;</span>?
        </p>
        <p className="text-xs text-red-600 leading-relaxed">
          Lokal neće biti vidljiv u pretrazi ni na mapi. Aktivni oglasi ostaju sačuvani. Možete ga reaktivirati u svakom trenutku.
        </p>
        {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirming(false); setError(null); }}
            className="btn-dash-outline flex-1 py-2 text-sm"
          >
            Otkaži
          </button>
          <button
            onClick={handleToggle}
            disabled={loading}
            className="flex-1 py-2 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Deaktiviraj"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm font-bold text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors w-fit"
    >
      Deaktiviraj lokal
    </button>
  );
}
