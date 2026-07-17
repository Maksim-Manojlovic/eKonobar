"use client";

import { useState, useCallback, useMemo } from "react";
import { EMPTY_FILTERS } from "./map-constants";
import type { MapFilters } from "./map-types";

/**
 * Grouped filter state — one typed object + a `setField` updater, per the
 * "Grouped form state" convention in CLAUDE.md (never one `useState` per field).
 */
export function useMapFilters() {
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);

  const setField = useCallback(<K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Chip behaviour: clicking the active value clears it. */
  const toggleField = useCallback(<K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? EMPTY_FILTERS[key] : value }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const activeCount = useMemo(
    () =>
      (Object.keys(filters) as (keyof MapFilters)[]).filter(
        (k) => filters[k] !== EMPTY_FILTERS[k],
      ).length,
    [filters],
  );

  return { filters, setField, toggleField, reset, activeCount };
}
