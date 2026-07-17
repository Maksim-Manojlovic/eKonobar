"use client";

import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";
import { EMPTY_STATE, isJob } from "./map-constants";
import type { MapFeature, MapProps } from "./map-types";
import type { MapState } from "./useMapState";

/**
 * Props for both panels. One bundle drives the desktop sidebar and the mobile
 * sheet so the two never fork — a filter added here appears on both surfaces.
 */
export interface MapPanelProps {
  mode:              MapState["mode"];
  features:          MapFeature[];
  loading:           boolean;
  error:             boolean;
  filters:           MapState["filters"];
  toggleField:       MapState["toggleField"];
  resetFilters:      () => void;
  activeFilterCount: number;
  selectedId:        string | null;
  hoveredId:         string | null;
  onOpenMarker:      (p: MapProps, lng: number, lat: number) => void;
  onHover:           (id: string | null) => void;
}

const chipCls = (active: boolean, tone: "orange" | "red" | "blue" = "orange") => {
  const on = { orange: "bg-orange-500 border-orange-500", red: "bg-red-500 border-red-500", blue: "bg-blue-500 border-blue-500" }[tone];
  const hover = { orange: "hover:border-orange-300", red: "hover:border-red-300", blue: "hover:border-blue-300" }[tone];
  return `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
    active ? `${on} text-white` : `bg-white text-neutral-600 border-neutral-200 ${hover}`
  }`;
};

export function MapFilterChips({ mode, filters, toggleField }: MapPanelProps) {
  if (mode === "jobs") {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(ENGAGEMENT_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => toggleField("engagementType", value)}
            className={chipCls(filters.engagementType === value)}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => toggleField("redAlertOnly", !filters.redAlertOnly)}
          className={`${chipCls(filters.redAlertOnly, "red")} flex items-center gap-1.5`}
        >
          <span className={`w-2 h-2 rounded-full ${filters.redAlertOnly ? "bg-white" : "bg-red-500"}`} />
          Red Alert
        </button>
        <button
          onClick={() => toggleField("sanitaryFree", !filters.sanitaryFree)}
          className={chipCls(filters.sanitaryFree, "blue")}
        >
          Bez sanitarne
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
        <button
          key={value}
          onClick={() => toggleField("venueType", value)}
          className={chipCls(filters.venueType === value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultRow({ props: p, selected, hovered, onOpen, onHover }: {
  props:    MapProps;
  selected: boolean;
  hovered:  boolean;
  onOpen:   () => void;
  onHover:  (id: string | null) => void;
}) {
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => onHover(p.id)}
      onMouseLeave={() => onHover(null)}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? "border-orange-500 bg-orange-50"
          : hovered
            ? "border-orange-300 bg-orange-50/50"
            : "border-neutral-200 bg-white hover:border-orange-200"
      }`}
    >
      {isJob(p) ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-neutral-900 leading-tight">{p.title}</p>
            {p.redAlert && (
              <span className="text-[9px] font-black text-red-600 uppercase shrink-0 mt-0.5">
                Red Alert
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {p.venue.name}
            {p.venue.municipality && ` · ${p.venue.municipality}`}
          </p>
          <p className="text-[11px] text-neutral-600 font-bold mt-1">
            {formatSalary({
              salaryMin: p.salaryMin,
              salaryMax: p.salaryMax,
              engagementType: p.engagementType,
            })}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-neutral-900 leading-tight">{p.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {VENUE_TYPE_LABELS[p.venueType ?? ""] ?? p.venueType}
            {p.municipality && ` · ${p.municipality}`}
          </p>
          {p.activeJobs > 0 && (
            <p className="text-[11px] text-orange-600 font-bold mt-1">
              {p.activeJobs} aktivnih oglasa
            </p>
          )}
        </>
      )}
    </button>
  );
}

/** Result list — hovering a row highlights its pin, clicking flies to it. */
export function MapResultList(props: MapPanelProps) {
  const { mode, features, loading, error, selectedId, hoveredId, onOpenMarker, onHover, activeFilterCount, resetFilters } = props;

  if (loading && features.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-neutral-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && features.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-neutral-500 font-medium">Greška pri učitavanju.</p>
        <p className="text-xs text-neutral-400 mt-1">Pomeri mapu i pokušaj ponovo.</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-2">{EMPTY_STATE[mode].icon}</p>
        <p className="text-sm text-neutral-500 font-medium">{EMPTY_STATE[mode].text}</p>
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 mt-2"
          >
            Poništi filtere
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {features.map((f) => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        return (
          <ResultRow
            key={p.id}
            props={p}
            selected={p.id === selectedId}
            hovered={p.id === hoveredId}
            onOpen={() => onOpenMarker(p, lng, lat)}
            onHover={onHover}
          />
        );
      })}
    </div>
  );
}

/** Count line — "N oglasa" / "N lokala" in this viewport. */
export function MapResultCount({ mode, features, loading }: MapPanelProps) {
  const noun = mode === "jobs" ? "oglasa" : "lokala";
  return (
    <p className="text-xs text-neutral-400 font-bold">
      {loading ? "Učitavam…" : `${features.length} ${noun} u ovom području`}
    </p>
  );
}
