"use client";

import {
  MapFilterChips,
  MapResultCount,
  MapResultList,
  type MapPanelProps,
} from "./MapPanelContent";

/** Desktop side panel. Hidden below `md` — the mobile sheet takes over there. */
export function MapSidebar(props: MapPanelProps) {
  return (
    <aside className="hidden md:flex w-80 shrink-0 flex-col gap-3 border-l border-neutral-200 bg-neutral-50 p-4 overflow-y-auto">
      <MapFilterChips {...props} />
      <MapResultCount {...props} />
      <MapResultList {...props} />
    </aside>
  );
}
