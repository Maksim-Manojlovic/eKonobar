"use client";

import Map, { NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { ClusterMarkers } from "./MapMarkers";
import { MapPopup } from "./MapPopup";
import { MapLegend } from "./MapLegend";
import { MapSidebar } from "./MapSidebar";
import { MapMobileSheet } from "./MapMobileSheet";
import type { MapPanelProps } from "./MapPanelContent";
import { INITIAL_VIEW, MAP_STYLE, applyBasemapConfig } from "./map-constants";
import { mapThemeTokens } from "./map-theme";
import { useMapState } from "./useMapState";
import type { MapMode, MapTheme } from "./map-types";

export interface Props {
  mode: MapMode;
  /**
   * Visual theme. Public pages are light; the dashboards run on `#120a00` and
   * must pass `"dark"` or the map renders as a white slab inside them.
   */
  theme?: MapTheme;
  className?: string;
}

export default function MapSearch({ mode, theme = "light", className = "" }: Props) {
  // Read at render, not module scope: Next inlines NEXT_PUBLIC_* wherever it is
  // referenced, and reading here keeps the token overridable in tests.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const s = useMapState(mode);
  const t = mapThemeTokens(theme);

  // One bundle drives both panels — the desktop sidebar and the mobile sheet
  // render the same filters and results, so neither can drift from the other.
  const panelProps: MapPanelProps = {
    mode:              s.mode,
    theme,
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
      <div className={`flex items-center justify-center rounded-3xl border min-h-[400px] ${t.shell} ${className}`}>
        <p className={`text-sm ${t.muted}`}>Mapbox token nije konfigurisan.</p>
      </div>
    );
  }

  return (
    <div
      className={`flex rounded-3xl overflow-hidden border shadow-[0_2px_4px_rgba(0,0,0,0.03),0_12px_40px_rgba(0,0,0,0.10)] h-[70vh] min-h-[460px] max-h-[720px] ${t.shell} ${className}`}
    >
      <div className="relative flex-1">
        <Map
          ref={s.mapRef}
          initialViewState={INITIAL_VIEW}
          mapboxAccessToken={mapboxToken}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          onLoad={() => {
            // Theme lives in the Standard style's config, not in a second style
            // URL — swapping URLs would drop the loaded tiles and re-download.
            applyBasemapConfig(s.mapRef.current?.getMap?.(), t.lightPreset);
            s.handleLoad();
          }}
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

          {s.popup && <MapPopup popup={s.popup} theme={theme} onClose={s.closePopup} />}
        </Map>

        {/* Panning arms this instead of refetching — the user chooses when to
            spend a query, and results never shift under a casual scroll. */}
        {s.showSearchHere && !s.loading && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <button
              onClick={s.search}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-lg backdrop-blur-sm transition-colors hover:border-orange-400 hover:text-orange-500 ${t.float} ${t.floatText}`}
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
          <div className={`absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur-sm pointer-events-none ${t.float}`}>
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            <p className={`text-xs font-bold ${t.floatText}`}>Učitavam…</p>
          </div>
        )}

        <MapLegend mode={s.mode} theme={theme} />

        <MapMobileSheet {...panelProps} />
      </div>

      <MapSidebar {...panelProps} />
    </div>
  );
}
