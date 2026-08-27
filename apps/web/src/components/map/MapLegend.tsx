"use client";

import { useState } from "react";
import { legendRows } from "./map-constants";
import { mapThemeTokens } from "./map-theme";
import type { MapMode, MapTheme } from "./map-types";

/**
 * Color key for the marker categories. Collapsible so it never fights the map on
 * small screens. Sits bottom-left over the canvas.
 */
export function MapLegend({ mode, theme }: { mode: MapMode; theme: MapTheme }) {
  const [open, setOpen] = useState(true);
  const rows = legendRows(mode);
  const t = mapThemeTokens(theme);

  return (
    <div className={`absolute bottom-3 left-3 z-10 rounded-xl backdrop-blur-sm shadow-lg border max-w-[60%] ${t.float} ${t.floatText}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold w-full"
        aria-expanded={open}
      >
        <span>Legenda</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          className={`transition-transform ${open ? "" : "-rotate-90"}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-2.5 pb-2 flex flex-col gap-1">
          {rows.map(([label, hex]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm shrink-0" style={{ backgroundColor: hex }} />
              <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
