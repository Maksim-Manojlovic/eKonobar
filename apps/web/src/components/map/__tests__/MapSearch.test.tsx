// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// react-map-gl needs a real WebGL canvas, so the map itself is mocked. What is
// under test is the wiring: onLoad/onMoveEnd → fetch, and what the panels render.
// The geojson routes themselves are covered by their own route tests.
const flyTo = vi.fn();
const getBounds = () => ({
  getSouth: () => 44.7,
  getWest:  () => 20.3,
  getNorth: () => 44.9,
  getEast:  () => 20.5,
});

let lastOnLoad: (() => void) | null = null;
let lastOnMoveEnd: (() => void) | null = null;

vi.mock("react-map-gl/mapbox", () => {
  return {
    __esModule: true,
    default: React.forwardRef(function MapMock(
      props: { onLoad?: () => void; onMoveEnd?: () => void; children?: React.ReactNode },
      ref: React.Ref<unknown>,
    ) {
      lastOnLoad = props.onLoad ?? null;
      lastOnMoveEnd = props.onMoveEnd ?? null;
      React.useImperativeHandle(ref, () => ({ getBounds, flyTo, getZoom: () => 12 }), []);
      return React.createElement("div", { "data-testid": "map" }, props.children);
    }),
    NavigationControl: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "marker" }, children),
    Popup: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "popup" }, children),
  };
});

vi.mock("@/lib/geo/cities", () => ({
  DEFAULT_CITY: { id: "BEOGRAD", label: "Beograd", center: { longitude: 20.46, latitude: 44.81 }, zoom: 12 },
}));

import MapSearch from "../MapSearch";

const JOB_FEATURE = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [20.4, 44.8] },
  properties: {
    id: "j-1",
    title: "Konobar u Skadarliji",
    engagementType: "FULL_TIME",
    tipSystem: null,
    salaryMin: 60000,
    salaryMax: 80000,
    sanitaryRequired: false,
    redAlert: false,
    redAlertNote: null,
    startDate: null,
    venue: { id: "v-1", name: "Kafana Test", municipality: "Vračar", venueType: "CAFE", trustScore: 80 },
  },
};

function mockFetchOnce(features: unknown[] = [JOB_FEATURE]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ type: "FeatureCollection", features }),
  });
}

/** URLs the component fetched, in order. */
const calls = () => vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "pk.test");
  lastOnLoad = null;
  lastOnMoveEnd = null;
  flyTo.mockClear();
  global.fetch = mockFetchOnce() as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MapSearch", () => {
  it("fetches the current viewport once the map loads", async () => {
    render(<MapSearch mode="jobs" />);
    expect(global.fetch).not.toHaveBeenCalled();

    lastOnLoad?.();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(calls()[0]).toContain("/api/jobs/geojson?");
    expect(calls()[0]).toContain("swLat=44.7");
    expect(calls()[0]).toContain("neLng=20.5");
  });

  it("renders fetched results in the panel", async () => {
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() => expect(screen.getAllByText("Konobar u Skadarliji").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/1 oglasa u ovom području/).length).toBeGreaterThan(0);
  });

  it("panning does NOT refetch — it offers to search the area instead", async () => {
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    lastOnMoveEnd?.();

    await waitFor(() =>
      expect(screen.getAllByText(/Pretraži ovo područje/).length).toBeGreaterThan(0),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("clicking 'Pretraži ovo područje' refetches and dismisses the button", async () => {
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    lastOnMoveEnd?.();

    const btn = await screen.findByText(/Pretraži ovo područje/);
    fireEvent.click(btn);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/Pretraži ovo područje/)).toBeNull());
  });

  it("a filter chip refetches server-side with the param applied", async () => {
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    // Target a chip button — "Red Alert" also appears as a legend label (a span),
    // and the chip renders in both the desktop sidebar and the mobile sheet.
    fireEvent.click(screen.getAllByRole("button", { name: /Red Alert/ })[0]);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    // The whole point of A2: the filter goes to the server, not to a .filter().
    expect(calls()[1]).toContain("redAlert=true");
  });

  it("venues mode targets the venues endpoint", async () => {
    global.fetch = mockFetchOnce([]) as unknown as typeof fetch;
    render(<MapSearch mode="venues" />);
    lastOnLoad?.();
    await waitFor(() => expect(calls()[0]).toContain("/api/venues/geojson?"));
  });

  it("a failed fetch surfaces an error instead of a silent empty map", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() =>
      expect(screen.getAllByText(/Greška pri učitavanju/).length).toBeGreaterThan(0),
    );
  });

  it("shows the empty state when the viewport has no results", async () => {
    global.fetch = mockFetchOnce([]) as unknown as typeof fetch;
    render(<MapSearch mode="jobs" />);
    lastOnLoad?.();
    await waitFor(() =>
      expect(screen.getAllByText(/Nema oglasa u ovom području/).length).toBeGreaterThan(0),
    );
  });

  it("renders the token fallback when NEXT_PUBLIC_MAPBOX_TOKEN is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    render(<MapSearch mode="jobs" />);
    expect(screen.getByText(/Mapbox token nije konfigurisan/)).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
