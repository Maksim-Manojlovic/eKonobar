"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import VenueCard, { type VenueCardProps } from "@/components/venue/VenueCard";
import Navbar from "@/components/layout/Navbar";
import Spinner from "@/components/ui/Spinner";

const MapSearch = dynamic(() => import("@/components/map/MapSearch"), { ssr: false });

const VENUE_TYPES = [
  { value: "",           label: "Svi tipovi" },
  { value: "RESTAURANT", label: "Restoran"   },
  { value: "CAFE",       label: "Kafić"      },
  { value: "BAR",        label: "Bar"        },
  { value: "CATERING",   label: "Ketering"   },
  { value: "HOTEL",      label: "Hotel"      },
  { value: "EVENT",      label: "Event"      },
];

type Venue = VenueCardProps & { id: string };

export default function VenuesPage() {
  const [venues, setVenues]         = useState<Venue[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView]             = useState<"list" | "map">("list");

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => r.json())
      .then((data: Venue[]) => setVenues(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = venues.filter((v) => {
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.municipality?.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || v.venueType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="min-h-screen hero-bg">
      <Navbar activePath="/venues" />
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Lokali</p>
          <h1 className="text-3xl font-black text-neutral-900">Pronađi lokal</h1>
          <p className="text-neutral-500 mt-1">
            {venues.length} lokala na platformi
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži po imenu ili opštini..."
            className="auth-input flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {VENUE_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  typeFilter === value
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setView("list")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              view === "list"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              view === "map"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
            }`}
          >
            Mapa
          </button>
        </div>

        {/* Map view */}
        {view === "map" && <MapSearch mode="venues" />}

        {/* List view */}
        {view === "list" && (loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-neutral-500 font-medium">
              {search || typeFilter ? "Nema lokala koji odgovara filteru." : "Još nema lokala."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v) => (
              <VenueCard key={v.id} {...v} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
