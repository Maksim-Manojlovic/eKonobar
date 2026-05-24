"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { VENUE_TYPE_LABELS } from "@/lib/display-maps";

type ApiVenue = {
  id: string;
  name: string;
  municipality: string;
  venueType: string;
  trustScore: number;
};


const VENUE_TYPE_GRADIENTS: Record<string, string> = {
  RESTAURANT: "linear-gradient(135deg, #c2410c, #9a3412)",
  BAR:        "linear-gradient(135deg, #b45309, #92400e)",
  CAFE:       "linear-gradient(135deg, #a16207, #854d0e)",
  NIGHTCLUB:  "linear-gradient(135deg, #7c3aed, #5b21b6)",
  HOTEL:      "linear-gradient(135deg, #0f766e, #065f46)",
  CATERING:   "linear-gradient(135deg, #be123c, #9f1239)",
  OTHER:      "linear-gradient(135deg, #374151, #1f2937)",
};

const VENUE_TYPE_TAGS: Record<string, string[]> = {
  RESTAURANT: ["Fine dining", "Stalna mesta"],
  BAR:        ["Vikend smene", "Napojnice ↑"],
  CAFE:       ["Jutarnje smene", "Fleksibilno"],
  NIGHTCLUB:  ["Noćne smene", "Napojnice ↑"],
  HOTEL:      ["Stalno", "Benefiti ↑"],
  CATERING:   ["Povremeno", "Brz odgovor"],
  OTHER:      ["Fleksibilno"],
};

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Hardcoded fallback shown before API data loads
const FALLBACK = [
  { name: "Freestyler",    venueType: "NIGHTCLUB",   municipality: "Savamala",    trustScore: 96 },
  { name: "Salon 1905",    venueType: "RESTAURANT",  municipality: "Stari Grad",  trustScore: 98 },
  { name: "Kafeterija Dok",venueType: "CAFE",        municipality: "Savamala",    trustScore: 88 },
  { name: "Manufaktura",   venueType: "RESTAURANT",  municipality: "Zemun",       trustScore: 94 },
  { name: "Bar Central",   venueType: "BAR",         municipality: "Dorćol",      trustScore: 90 },
  { name: "Pekara Trpković",venueType: "CAFE",       municipality: "Više lokacija",trustScore: 92 },
] as const;

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const empty = 5 - full;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <svg key={`f${i}`} width="12" height="12" viewBox="0 0 10 10" fill="#f97316">
          <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
        </svg>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <svg key={`e${i}`} width="12" height="12" viewBox="0 0 10 10" fill="#94a3b8">
          <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
        </svg>
      ))}
    </div>
  );
}

function VenueCard({ venue, featured }: { venue: ApiVenue; featured: boolean; idx?: number }) {
  const gradient = VENUE_TYPE_GRADIENTS[venue.venueType] ?? VENUE_TYPE_GRADIENTS.OTHER;
  const tags = VENUE_TYPE_TAGS[venue.venueType] ?? VENUE_TYPE_TAGS.OTHER;
  const rating = Math.round(venue.trustScore / 20 * 10) / 10;
  const pulsing = venue.trustScore > 85;

  const cardBg = featured ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.06)";
  const cardBorder = featured ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.1)";
  const tagBg = featured
    ? "bg-orange-500/10 border-orange-400/20 text-orange-300"
    : "bg-white/5 border-white/10 text-neutral-400";
  const dividerColor = featured ? "border-orange-500/20" : "border-white/[0.08]";
  const applyColor = featured ? "text-orange-300" : "text-orange-400";

  return (
    <Link
      href="/venues"
      className="group cursor-pointer rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
      style={{ background: cardBg, border: cardBorder, backdropFilter: "blur(20px)" }}
    >
      {featured && (
        <div className="absolute top-4 right-4 bg-orange-500 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full uppercase">
          Istaknuto
        </div>
      )}
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "rgba(249,115,22,0.07)" }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white flex-shrink-0"
            style={{ background: gradient }}
          >
            {getInitials(venue.name)}
          </div>
          <div className="flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/25 px-3 py-1 rounded-full">
            {pulsing && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
            {!pulsing && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
            <span className="text-orange-300 text-xs font-bold">{Math.round(venue.trustScore)}</span>
          </div>
        </div>

        <h3 className="text-white font-bold text-lg mb-1">{venue.name}</h3>
        <p className={`text-xs font-medium mb-4 ${featured ? "text-neutral-400" : "text-neutral-500"}`}>
          {venue.municipality} · {VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stars rating={rating} />
            <span className="text-white font-bold text-sm">{rating}</span>
          </div>
          <span className={`text-xs font-semibold group-hover:translate-x-1 transition-transform inline-block ${applyColor}`}>
            Prijavi se →
          </span>
        </div>

        <div className={`mt-4 pt-4 border-t ${dividerColor} flex gap-2`}>
          {tags.map((tag) => (
            <span key={tag} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${tagBg}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

const trustItems = [
  {
    label: "Svi lokali provereni",
    icon: <path d="M8 1L9.545 5.27H14.09L10.273 7.855L11.818 12.125L8 9.54L4.182 12.125L5.727 7.855L1.91 5.27H6.455L8 1Z" fill="#f97316" />,
  },
  {
    label: "Geofencing recenzije",
    icon: <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM7 11L4.5 8.5L5.56 7.44L7 8.88L10.44 5.44L11.5 6.5L7 11Z" fill="#f97316" />,
  },
  {
    label: "Besplatno oglašavanje",
    icon: <><rect x="2" y="3" width="12" height="10" rx="2.5" stroke="#f97316" strokeWidth="1.5" fill="none" /><path d="M8 6V9M6.5 7.5H9.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" /></>,
  },
  {
    label: "Waiter Passport™ sistem",
    icon: <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
  },
];

export function TopVenuesSection() {
  const [venues, setVenues] = useState<ApiVenue[]>([]);

  useEffect(() => {
    fetch("/api/venues")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setVenues(d.slice(0, 6));
        }
      })
      .catch(() => {/* use fallback silently */});
  }, []);

  const displayVenues: ApiVenue[] = venues.length > 0
    ? venues
    : (FALLBACK as unknown as ApiVenue[]);

  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2d1a06 50%, #1c110a 100%)" }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 20% 50%, rgba(249,115,22,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 80% 30%, rgba(234,88,12,0.12) 0%, transparent 55%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 48px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 48px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <span
              className="inline-block text-orange-400 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5"
              style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              Top Lokali
            </span>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Radi u <span className="text-orange-400">najboljim</span> lokalima<br />Beograda
            </h2>
            <p className="mt-4 text-neutral-400 font-light text-lg max-w-lg">
              Konobari koji su radili u ovim objektima ocenili su ih vrhunski. Tvoj sledeći angažman čeka.
            </p>
          </div>
          <Link
            href="/venues"
            className="flex-shrink-0 flex items-center gap-2 text-orange-400 font-semibold text-sm hover:text-orange-300 transition-colors whitespace-nowrap"
          >
            Prikaži sve lokale
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayVenues.map((v, i) => (
            <VenueCard key={v.name ?? i} venue={v} featured={i === 1} idx={i} />
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {trustItems.map((item, i) => (
            <div key={item.label} className="flex items-center gap-2.5">
              {i > 0 && <div className="w-px h-4 bg-neutral-700 hidden sm:block mr-10" />}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {item.icon}
              </svg>
              <span className="text-neutral-500 text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
