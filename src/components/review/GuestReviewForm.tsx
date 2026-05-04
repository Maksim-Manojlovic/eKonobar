"use client";

import { useState, useEffect } from "react";
import ReviewWizard from "./ReviewWizard";

type Venue = { id: string; name: string; municipality: string };

interface GuestReviewFormProps {
  subjectId: string;
  subjectName?: string;
  prefillVenueId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GuestReviewForm({
  subjectId,
  subjectName,
  prefillVenueId,
  onSuccess,
  onCancel,
}: GuestReviewFormProps) {
  const [venues, setVenues]           = useState<Venue[]>([]);
  const [search, setSearch]           = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);

  useEffect(() => {
    if (prefillVenueId) return;
    setLoadingVenues(true);
    fetch("/api/venues")
      .then(r => r.json())
      .then(d => setVenues(Array.isArray(d) ? d : []))
      .finally(() => setLoadingVenues(false));
  }, [prefillVenueId]);

  // venueId is known → go straight to wizard
  if (prefillVenueId || selectedVenue) {
    return (
      <ReviewWizard
        direction="GUEST_TO_WAITER"
        subjectId={subjectId}
        subjectName={subjectName}
        venueId={prefillVenueId ?? selectedVenue!.id}
        venueName={selectedVenue?.name}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );
  }

  const filtered = search.trim()
    ? venues.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.municipality.toLowerCase().includes(search.toLowerCase())
      )
    : venues.slice(0, 8);

  return (
    <div className="dash-card p-6 max-w-md w-full flex flex-col gap-4">
      <div className="text-center">
        <div className="text-4xl mb-2">🍽️</div>
        <h3 className="font-black text-lg text-neutral-900">Koji lokal posećuješ?</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Izaberi lokal da bismo potvrdili da si u njemu.
        </p>
      </div>

      <input
        type="text"
        placeholder="Pretraži lokal po imenu ili opštini..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
      />

      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
        {loadingVenues ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(v => (
            <button
              key={v.id}
              onClick={() => setSelectedVenue(v)}
              className="text-left px-3 py-2.5 rounded-lg hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-colors"
            >
              <p className="text-sm font-semibold text-neutral-900">{v.name}</p>
              <p className="text-xs text-neutral-400">{v.municipality}</p>
            </button>
          ))
        ) : (
          <p className="text-sm text-neutral-400 text-center py-4">
            {search ? "Lokal nije pronađen." : "Nema dostupnih lokala."}
          </p>
        )}
      </div>

      <button
        onClick={onCancel}
        className="text-xs text-neutral-400 hover:text-neutral-600 text-center transition-colors"
      >
        Otkaži
      </button>
    </div>
  );
}
