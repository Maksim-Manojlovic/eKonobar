"use client";

import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";
import { formatSalary } from "@/lib/formatting/utils";
import { EMPTY_STATE, isJob, markerColor } from "./map-constants";
import { mapThemeTokens, type MapThemeTokens } from "./map-theme";
import type { MapFeature, MapProps, MapTheme } from "./map-types";
import type { MapState } from "./useMapState";

/**
 * Props for both panels. One bundle drives the desktop sidebar and the mobile
 * sheet so the two never fork — a filter added here appears on both surfaces.
 */
export interface MapPanelProps {
  mode:              MapState["mode"];
  theme:             MapTheme;
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

const chipCls = (t: MapThemeTokens, active: boolean, tone: "orange" | "red" | "blue" = "orange") => {
  const on = { orange: "bg-orange-500 border-orange-500", red: "bg-red-500 border-red-500", blue: "bg-blue-500 border-blue-500" }[tone];
  const hover = { orange: "hover:border-orange-300", red: "hover:border-red-300", blue: "hover:border-blue-300" }[tone];
  return `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
    active ? `${on} text-white` : `${t.chipIdle} ${hover}`
  }`;
};

export function MapFilterChips({ mode, theme, filters, toggleField }: MapPanelProps) {
  const t = mapThemeTokens(theme);

  if (mode === "jobs") {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(ENGAGEMENT_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => toggleField("engagementType", value)}
            className={chipCls(t, filters.engagementType === value)}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => toggleField("redAlertOnly", !filters.redAlertOnly)}
          className={`${chipCls(t, filters.redAlertOnly, "red")} flex items-center gap-1.5`}
        >
          <span className={`w-2 h-2 rounded-full ${filters.redAlertOnly ? "bg-white" : "bg-red-500"}`} />
          Red Alert
        </button>
        <button
          onClick={() => toggleField("sanitaryFree", !filters.sanitaryFree)}
          className={chipCls(t, filters.sanitaryFree, "blue")}
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
          className={chipCls(t, filters.venueType === value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultRow({ props: p, t, selected, hovered, onOpen, onHover }: {
  props:    MapProps;
  t:        MapThemeTokens;
  selected: boolean;
  hovered:  boolean;
  onOpen:   () => void;
  onHover:  (id: string | null) => void;
}) {
  // Same hue the pin uses, so scanning the list and scanning the map are the
  // same act — the row's dot is the legend entry for its marker.
  const accent = isJob(p) && p.redAlert ? "#ef4444" : markerColor(p);

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => onHover(p.id)}
      onMouseLeave={() => onHover(null)}
      className={`w-full text-left p-3 pl-4 rounded-xl border transition-all relative overflow-hidden ${
        selected ? t.row.selected : hovered ? t.row.hovered : t.row.base
      }`}
    >
      <span
        className="absolute left-0 inset-y-0 w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      {isJob(p) ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-bold leading-tight ${t.rowTitle}`}>{p.title}</p>
            {p.redAlert && (
              <span className="text-[9px] font-black text-red-500 uppercase shrink-0 mt-0.5">
                Red Alert
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${t.rowSub}`}>
            {p.venue.name}
            {p.venue.municipality && ` · ${p.venue.municipality}`}
          </p>
          <p className={`text-[11px] font-bold mt-1 ${t.rowTitle}`}>
            {formatSalary({
              salaryMin: p.salaryMin,
              salaryMax: p.salaryMax,
              engagementType: p.engagementType,
            })}
          </p>
        </>
      ) : (
        <>
          <p className={`text-sm font-bold leading-tight ${t.rowTitle}`}>{p.name}</p>
          <p className={`text-xs mt-0.5 ${t.rowSub}`}>
            {VENUE_TYPE_LABELS[p.venueType ?? ""] ?? p.venueType}
            {p.municipality && ` · ${p.municipality}`}
          </p>
          {p.activeJobs > 0 && (
            <p className="text-[11px] text-orange-500 font-bold mt-1">
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
  const { mode, theme, features, loading, error, selectedId, hoveredId, onOpenMarker, onHover, activeFilterCount, resetFilters } = props;
  const t = mapThemeTokens(theme);

  if (loading && features.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-20 rounded-xl animate-pulse ${t.skeleton}`} />
        ))}
      </div>
    );
  }

  if (error && features.length === 0) {
    return (
      <div className="text-center py-10">
        <p className={`text-sm font-medium ${t.rowSub}`}>Greška pri učitavanju.</p>
        <p className={`text-xs mt-1 ${t.muted}`}>Pomeri mapu i pokušaj ponovo.</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-2">{EMPTY_STATE[mode].icon}</p>
        <p className={`text-sm font-medium ${t.rowSub}`}>{EMPTY_STATE[mode].text}</p>
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-orange-500 hover:text-orange-400 mt-2"
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
            t={t}
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
export function MapResultCount({ mode, theme, features, loading }: MapPanelProps) {
  const noun = mode === "jobs" ? "oglasa" : "lokala";
  return (
    <p className={`text-xs font-bold ${mapThemeTokens(theme).muted}`}>
      {loading ? "Učitavam…" : `${features.length} ${noun} u ovom području`}
    </p>
  );
}
