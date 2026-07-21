/**
 * Per-theme visual tokens for the map surface.
 *
 * The same `MapSearch` renders on the light public pages (`/jobs`, `/venues`,
 * `/for-waiters`) and inside the dark waiter dashboard (`#120a00`). One token bag
 * per theme keeps the basemap, the floating chrome and the side panel in step —
 * a white sidebar beside a night basemap is the same mismatch as a white basemap
 * inside a dark dashboard, just inverted.
 *
 * Tokens only. No JSX, no component imports — every map file may import this.
 */

import type { MapTheme } from "./map-types";

export interface MapThemeTokens {
  /**
   * Mapbox Standard `lightPreset` — drives sky, shadow direction and the
   * lighting on 3D buildings. Applied imperatively in `onLoad` via
   * `setConfigProperty`, not as a style URL.
   */
  lightPreset: "day" | "night";
  /** Outer shell: border + backdrop behind the canvas. */
  shell: string;
  /** Sidebar / mobile-sheet surface. */
  panel: string;
  /** Divider between canvas and panel. */
  panelBorder: string;
  /** Floating pill over the canvas (loading, "search here", legend). */
  float: string;
  /** Text inside a floating pill. */
  floatText: string;
  /** Result-row surface states. */
  row: { base: string; hovered: string; selected: string };
  rowTitle: string;
  rowSub: string;
  /** Filter chip, inactive state (the active state stays brand-colored). */
  chipIdle: string;
  /** De-emphasised copy: result counts, empty states. */
  muted: string;
  /** Skeleton block fill. */
  skeleton: string;
  /**
   * Class handed to the mapbox `<Popup>`; the actual chrome override lives in
   * `globals.css` (mapbox owns `.mapboxgl-popup-content`, which Tailwind classes
   * on the React element cannot reach).
   */
  popup: string;
}

const LIGHT: MapThemeTokens = {
  lightPreset: "day",
  shell:       "border-neutral-200 bg-neutral-100",
  panel:       "bg-neutral-50",
  panelBorder: "border-neutral-200",
  float:       "bg-white/95 border-neutral-200",
  floatText:   "text-neutral-700",
  row: {
    base:     "border-neutral-200 bg-white hover:border-orange-200",
    hovered:  "border-orange-300 bg-orange-50/50",
    selected: "border-orange-500 bg-orange-50",
  },
  rowTitle: "text-neutral-900",
  rowSub:   "text-neutral-500",
  chipIdle: "bg-white text-neutral-600 border-neutral-200",
  muted:    "text-neutral-400",
  skeleton: "bg-neutral-200",
  popup:    "ek-popup ek-popup-light",
};

const DARK: MapThemeTokens = {
  lightPreset: "night",
  shell:       "border-white/10 bg-[#0e0700]",
  panel:       "bg-[#0e0700]",
  panelBorder: "border-white/10",
  float:       "bg-[#1a0e02]/95 border-white/15",
  floatText:   "text-white/80",
  row: {
    base:     "border-white/10 bg-white/5 hover:border-orange-400/40",
    hovered:  "border-orange-400/50 bg-orange-500/10",
    selected: "border-orange-500 bg-orange-500/20",
  },
  rowTitle: "text-white",
  rowSub:   "text-white/50",
  chipIdle: "bg-white/5 text-white/60 border-white/10",
  muted:    "text-white/40",
  skeleton: "bg-white/10",
  popup:    "ek-popup ek-popup-dark",
};

export function mapThemeTokens(theme: MapTheme): MapThemeTokens {
  return theme === "dark" ? DARK : LIGHT;
}
