"use client";

import Map, { NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { ClusterMarkers } from "./MapMarkers";
import { MapPopup } from "./MapPopup";
import { MapSidebar } from "./MapSidebar";
import { MapMobileSheet } from "./MapMobileSheet";
import type { MapPanelProps } from "./MapPanelContent";
import { INITIAL_VIEW, MAP_STYLE } from "./map-constants";
import { useMapState } from "./useMapState";
import type { MapMode } from "./map-types";

export interface Props {
  mode: MapMode;
  className?: string;
}

export default function MapSearch({ mode, className = "" }: Props) {
  // Read at render, not module scope: Next inlines NEXT_PUBLIC_* wherever it is
  // referenced, and reading here keeps the token overridable in tests.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const s = useMapState(mode);

  // One bundle drives both panels — the desktop sidebar and the mobile sheet
  // render the same filters and results, so neither can drift from the other.
  const panelProps: MapPanelProps = {
    mode:              s.mode,
    features:          s.features,
    loading:           s.loading,
    error:             s.error,
    filters:           s.filters,
    toggleField:       s.toggleField,
    resetFilters:      s.resetFilters,
    activeFilterCount: s.activeFilterCount,
    selectedId:        s.selectedId,
    hoveredId:         s.hoveredId,
    onOpenMarker:      s.openMarker,
    onHover:           s.setHoveredId,
  };

  if (!mapboxToken) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 rounded-2xl min-h-[400px] ${className}`}>
        <p className="text-sm text-neutral-400">Mapbox token nije konfigurisan.</p>
      </div>
    );
  }

  return (
    <div
      className={`flex rounded-2xl overflow-hidden border border-neutral-200 ${className}`}
      style={{ height: 520 }}
    >
      <div className="relative flex-1">
        <Map
          ref={s.mapRef}
          initialViewState={INITIAL_VIEW}
          mapboxAccessToken={mapboxToken}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          onLoad={s.handleLoad}
          onMoveEnd={s.handleMoveEnd}
          onClick={s.closePopup}
        >
          <NavigationControl position="top-right" />

          <ClusterMarkers
            clusters={s.clusters}
            supercluster={s.supercluster}
            mapRef={s.mapRef}
            selectedId={s.selectedId}
            hoveredId={s.hoveredId}
            onOpenMarker={s.openMarker}
            onHover={s.setHoveredId}
          />

          {s.popup && <MapPopup popup={s.popup} onClose={s.closePopup} />}
        </Map>

        {/* Panning arms this instead of refetching — the user chooses when to
            spend a query, and results never shift under a casual scroll. */}
        {s.showSearchHere && !s.loading && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <button
              onClick={s.search}
              className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-lg transition-colors hover:border-orange-300 hover:text-orange-600"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Pretraži ovo područje
            </button>
          </div>
        )}

        {s.loading && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1.5 shadow-sm pointer-events-none">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            <p className="text-xs font-bold text-neutral-500">Učitavam…</p>
          </div>
        )}

        <MapMobileSheet {...panelProps} />
      </div>

      <MapSidebar {...panelProps} />
    </div>
  );
}
