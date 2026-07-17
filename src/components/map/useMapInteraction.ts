"use client";

import { useRef, useState, useCallback } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import useSupercluster from "use-supercluster";
import type { Feature, Point } from "geojson";
import { CLUSTER_OPTIONS, INITIAL_VIEW } from "./map-constants";
import type { BBox, ClusterBounds, MapFeature, MapProps, PopupState } from "./map-types";

/**
 * Viewport, clustering and popup state.
 *
 * Panning does not refetch. It arms the "Pretraži ovo područje" button instead —
 * an auto-refetch on every `moveEnd` fires a DB query per drag frame settle, and
 * yanks results out from under someone who is only scrolling to look around.
 */
export function useMapInteraction(features: MapFeature[]) {
  const mapRef = useRef<MapRef>(null);

  const [showSearchHere, setShowSearchHere] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [popup, setPopup]           = useState<PopupState | null>(null);
  const [zoom, setZoom]             = useState(INITIAL_VIEW.zoom);
  const [bounds, setBounds]         = useState<ClusterBounds>([20.35, 44.72, 20.55, 44.88]);

  /** Current viewport as a bbox, or null before the map has loaded. */
  const readBBox = useCallback((): BBox | null => {
    const b = mapRef.current?.getBounds();
    if (!b) return null;
    return {
      swLat: b.getSouth(),
      swLng: b.getWest(),
      neLat: b.getNorth(),
      neLng: b.getEast(),
    };
  }, []);

  /** Recompute clustering inputs on pan/zoom, and offer a re-search. */
  const handleMoveEnd = useCallback(() => {
    const map = mapRef.current;
    const b = map?.getBounds();
    if (!map || !b) return;
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setZoom(Math.round(map.getZoom()));
    setShowSearchHere(true);
  }, []);

  const openMarker = useCallback((props: MapProps, lng: number, lat: number) => {
    setSelectedId(props.id);
    setPopup({ lng, lat, props });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: Math.max(zoom, 15), duration: 600 });
  }, [zoom]);

  const closePopup = useCallback(() => {
    setPopup(null);
    setSelectedId(null);
  }, []);

  const { clusters, supercluster } = useSupercluster({
    points: features as unknown as Feature<Point, MapProps>[],
    bounds,
    zoom,
    options: CLUSTER_OPTIONS,
  });

  return {
    mapRef,
    showSearchHere,
    setShowSearchHere,
    selectedId,
    hoveredId,
    setHoveredId,
    popup,
    zoom,
    clusters,
    supercluster,
    readBBox,
    handleMoveEnd,
    openMarker,
    closePopup,
  };
}
