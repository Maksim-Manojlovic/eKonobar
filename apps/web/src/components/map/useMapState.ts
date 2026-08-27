"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMapData } from "./useMapData";
import { useMapFilters } from "./useMapFilters";
import { useMapInteraction } from "./useMapInteraction";
import type { MapMode } from "./map-types";

/**
 * Composes the map's data, filter and interaction concerns into the single
 * bundle `MapSearch` renders and both panels (sidebar + mobile sheet) consume.
 */
export function useMapState(mode: MapMode) {
  const { filters, setField, toggleField, reset, activeCount } = useMapFilters();
  const { features, loading, error, fetchFeatures } = useMapData(mode);
  const interaction = useMapInteraction(features);

  const { readBBox, setShowSearchHere } = interaction;

  const search = useCallback(() => {
    const bbox = readBBox();
    if (!bbox) return;
    setShowSearchHere(false);
    void fetchFeatures(bbox, filters);
  }, [readBBox, setShowSearchHere, fetchFeatures, filters]);

  /** First fetch — the map has no bounds until it loads. */
  const handleLoad = useCallback(() => { search(); }, [search]);

  // A filter change refetches immediately against the current viewport: the user
  // asked a question about what is on screen and expects an answer, unlike a pan
  // (which only arms the search-here button).
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const bbox = readBBox();
    if (!bbox) return;
    setShowSearchHere(false);
    void fetchFeatures(bbox, filters);
  }, [filters, readBBox, setShowSearchHere, fetchFeatures]);

  return {
    mode,
    features,
    loading,
    error,
    filters,
    setField,
    toggleField,
    resetFilters: reset,
    activeFilterCount: activeCount,
    search,
    handleLoad,
    ...interaction,
  };
}

export type MapState = ReturnType<typeof useMapState>;
