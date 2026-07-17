"use client";

import { Popup } from "react-map-gl/mapbox";
import Link from "next/link";
import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";
import { isJob } from "./map-constants";
import type { PopupState } from "./map-types";

export function MapPopup({ popup, onClose }: { popup: PopupState; onClose: () => void }) {
  const p = popup.props;

  return (
    <Popup
      longitude={popup.lng}
      latitude={popup.lat}
      anchor="bottom"
      onClose={onClose}
      closeOnClick={false}
      maxWidth="260px"
    >
      {isJob(p) ? (
        <div className="p-1 flex flex-col gap-1.5">
          {p.redAlert && (
            <span className="text-[10px] font-black text-red-600 uppercase tracking-wide">
              Red Alert
            </span>
          )}
          <p className="text-sm font-black text-neutral-900 leading-tight">{p.title}</p>
          <p className="text-xs text-neutral-500">
            {p.venue.name}
            {p.venue.municipality && ` · ${p.venue.municipality}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-2 py-0.5 font-bold">
              {ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType}
            </span>
            <span className="text-[10px] text-neutral-600 font-bold">
              {formatSalary({
                salaryMin: p.salaryMin,
                salaryMax: p.salaryMax,
                engagementType: p.engagementType,
              })}
            </span>
          </div>
          <Link
            href={`/jobs/${p.id}`}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 mt-0.5"
          >
            Pogledaj oglas →
          </Link>
        </div>
      ) : (
        <div className="p-1 flex flex-col gap-1.5">
          <p className="text-sm font-black text-neutral-900 leading-tight">{p.name}</p>
          <p className="text-xs text-neutral-500">
            {VENUE_TYPE_LABELS[p.venueType ?? ""] ?? p.venueType}
            {p.municipality && ` · ${p.municipality}`}
          </p>
          {p.trustScore != null && (
            <p className="text-[10px] text-neutral-600 font-bold">
              Poverenje: {Math.round(p.trustScore)}/100
            </p>
          )}
          {p.activeJobs > 0 && (
            <p className="text-[10px] text-orange-600 font-bold">
              {p.activeJobs} aktivnih oglasa
            </p>
          )}
          <Link
            href={`/venues/${p.id}`}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 mt-0.5"
          >
            Pogledaj lokal →
          </Link>
        </div>
      )}
    </Popup>
  );
}
