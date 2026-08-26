"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { buildMapQuery, mapEndpoint } from "./map-constants";
import type { BBox, MapFeature, MapFilters, MapMode } from "./map-types";

/**
 * Fetches map features for a viewport + filters.
 *
 * Filters are sent to the server, never applied to the response: the geojson
 * routes cap each viewport at MAX_FEATURES, so a client-side `.filter()` would
 * filter an already-truncated page and quietly hide matches.
 */
export function useMapData(mode: MapMode) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);

  // Guards against a slow earlier response overwriting a newer one (pan fast, or
  // toggle filters mid-flight) and against setState after unmount.
  const reqRef   = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const fetchFeatures = useCallback(
    async (bbox: BBox, filters: MapFilters) => {
      const reqId = ++reqRef.current;
      setLoading(true);
      setError(false);
      try {
        const url = `${mapEndpoint(mode)}?${buildMapQuery(mode, bbox, filters)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const fc = await res.json();
        if (!aliveRef.current || reqId !== reqRef.current) return;
        setFeatures(Array.isArray(fc.features) ? fc.features : []);
      } catch {
        if (!aliveRef.current || reqId !== reqRef.current) return;
        // Keep the last good features on screen rather than blanking the map;
        // the sidebar surfaces the error state.
        setError(true);
      } finally {
        if (aliveRef.current && reqId === reqRef.current) setLoading(false);
      }
    },
    [mode],
  );

  return { features, loading, error, fetchFeatures };
}
