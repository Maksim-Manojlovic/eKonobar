"use client";

import { Popup } from "react-map-gl/mapbox";
import Link from "next/link";
import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";
import { isJob } from "./map-constants";
import { mapThemeTokens } from "./map-theme";
import type { MapTheme, PopupState } from "./map-types";

export function MapPopup({ popup, theme, onClose }: {
  popup: PopupState;
  theme: MapTheme;
  onClose: () => void;
}) {
  const p = popup.props;
  const t = mapThemeTokens(theme);

  return (
    <Popup
      longitude={popup.lng}
      latitude={popup.lat}
      anchor="bottom"
      onClose={onClose}
      closeOnClick={false}
      maxWidth="272px"
      // Mapbox owns `.mapboxgl-popup-content`, which Tailwind classes on this
      // element cannot reach — the chrome override lives in globals.css.
      className={t.popup}
    >
      {isJob(p) ? (
        <div className="p-1 flex flex-col gap-1.5">
          {p.redAlert && (
            <span className="text-[10px] font-black text-red-600 uppercase tracking-wide">
              Red Alert
            </span>
          )}
          <p className={`text-sm font-black leading-tight ${t.rowTitle}`}>{p.title}</p>
          <p className={`text-xs ${t.rowSub}`}>
            {p.venue.name}
            {p.venue.municipality && ` · ${p.venue.municipality}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-orange-500/15 border border-orange-500/40 text-orange-500 rounded-full px-2 py-0.5 font-bold">
              {ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType}
            </span>
            <span className={`text-[10px] font-bold ${t.rowTitle}`}>
              {formatSalary({
                salaryMin: p.salaryMin,
                salaryMax: p.salaryMax,
                engagementType: p.engagementType,
              })}
            </span>
          </div>
          <Link
            href={`/jobs/${p.id}`}
            className="text-xs font-bold text-orange-500 hover:text-orange-400 mt-0.5"
          >
            Pogledaj oglas →
          </Link>
        </div>
      ) : (
        <div className="p-1 flex flex-col gap-1.5">
          <p className={`text-sm font-black leading-tight ${t.rowTitle}`}>{p.name}</p>
          <p className={`text-xs ${t.rowSub}`}>
            {VENUE_TYPE_LABELS[p.venueType ?? ""] ?? p.venueType}
            {p.municipality && ` · ${p.municipality}`}
          </p>
          {p.trustScore != null && (
            <p className={`text-[10px] font-bold ${t.rowTitle}`}>
              Poverenje: {Math.round(p.trustScore)}/100
            </p>
          )}
          {p.activeJobs > 0 && (
            <p className="text-[10px] text-orange-500 font-bold">
              {p.activeJobs} aktivnih oglasa
            </p>
          )}
          <Link
            href={`/venues/${p.id}`}
            className="text-xs font-bold text-orange-500 hover:text-orange-400 mt-0.5"
          >
            Pogledaj lokal →
          </Link>
        </div>
      )}
    </Popup>
  );
}
