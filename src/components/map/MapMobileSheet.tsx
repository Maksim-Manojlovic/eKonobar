"use client";

import { useEffect, useState } from "react";
import {
  MapFilterChips,
  MapResultCount,
  MapResultList,
  type MapPanelProps,
} from "./MapPanelContent";
import { mapThemeTokens } from "./map-theme";

/**
 * Mobile bottom sheet — the same panel content as the desktop sidebar, in the
 * shape phones expect. Waiters are phone-first, so this is the primary surface,
 * not a fallback.
 *
 * Collapsed it shows filters + the result count so the map stays visible;
 * expanded it becomes a scrollable result list.
 */
export function MapMobileSheet(props: MapPanelProps) {
  const [open, setOpen] = useState(false);
  const t = mapThemeTokens(props.theme);

  // Body scroll lock while expanded — matches NotificationBell's sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="md:hidden absolute inset-x-0 bottom-0 z-20">
      <div
        className={`rounded-t-2xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.18)] flex flex-col ${t.panelBorder} ${t.panel}`}
        style={{
          maxHeight: open ? "82dvh" : "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col items-center gap-1.5 pt-2 pb-1 shrink-0"
          aria-expanded={open}
          aria-label={open ? "Sakrij rezultate" : "Prikaži rezultate"}
        >
          <span className={`h-1 w-10 rounded-full ${t.skeleton}`} />
        </button>

        <div className="px-4 pb-3 flex flex-col gap-3 shrink-0">
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="w-max">
              <MapFilterChips {...props} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <MapResultCount {...props} />
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs font-bold text-orange-500 hover:text-orange-400"
            >
              {open ? "Sakrij" : "Prikaži listu"}
            </button>
          </div>
        </div>

        {open && (
          <div className="px-4 pb-4 overflow-y-auto">
            <MapResultList {...props} />
          </div>
        )}
      </div>
    </div>
  );
}
