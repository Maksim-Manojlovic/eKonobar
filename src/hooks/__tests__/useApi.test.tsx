// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApi } from "@/hooks/useApi";

function okResponse<T>(body: T) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
}

describe("useApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches and returns data on mount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ x: 1 })));
    const { result } = renderHook(() => useApi<{ x: number }>("/api/test"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ x: 1 });
    expect(result.current.error).toBeNull();
  });

  it("skips fetch when enabled is false", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi("/api/test", { enabled: false }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("sets error on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error", json: async () => ({}) } as Response),
    );
    const { result } = renderHook(() => useApi("/api/test"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });

  it("mutate triggers a refetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ n: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi("/api/test"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.mutate(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
