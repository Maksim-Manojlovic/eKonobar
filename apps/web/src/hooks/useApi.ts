"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseApiOptions {
  /** Skip fetching while false (e.g. inactive tab). Default: true. */
  enabled?: boolean;
  /** Silent background refetch interval in ms (no isLoading toggle on poll). */
  refreshMs?: number;
}

export interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  /** Manual refetch (shows loading). Returns the promise so callers can await. */
  mutate: () => Promise<void>;
}

/**
 * Shared GET data-fetching hook for dashboard sections.
 *
 * Replaces the hand-rolled `useState(data)` + `useState(loading)` + `useEffect(fetch)`
 * + `.catch(() => {})` triplet duplicated across every section component (see CQ-G/CQ-H
 * in tech_debt_audit.md). Encapsulates loading/error state, unmount-safety, and the
 * silent 30s-poll pattern.
 *
 * ```ts
 * const { data, isLoading, error, mutate } = useApi<MarketData>("/api/insights/market");
 * const { data: open } = useApi<OpenShift[]>("/api/shifts?view=open", { enabled: tab === "open", refreshMs: 30_000 });
 * ```
 */
export function useApi<T>(url: string, options: UseApiOptions = {}): UseApiResult<T> {
  const { enabled = true, refreshMs } = options;

  const [data, setData]           = useState<T | null>(null);
  const [error, setError]         = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);

  // Track mount status so we never setState after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(
    async (showLoading: boolean) => {
      if (showLoading && mountedRef.current) setIsLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = (await res.json()) as T;
        if (mountedRef.current) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (showLoading && mountedRef.current) setIsLoading(false);
      }
    },
    [url],
  );

  const mutate = useCallback(() => run(true), [run]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void run(true);
    if (!refreshMs) return;
    const id = setInterval(() => void run(false), refreshMs);
    return () => clearInterval(id);
  }, [enabled, refreshMs, run]);

  return { data, error, isLoading, mutate };
}
