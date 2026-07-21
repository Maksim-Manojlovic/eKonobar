"use client";

import {
  MapFilterChips,
  MapResultCount,
  MapResultList,
  type MapPanelProps,
} from "./MapPanelContent";
import { mapThemeTokens } from "./map-theme";

/** Desktop side panel. Hidden below `md` — the mobile sheet takes over there. */
export function MapSidebar(props: MapPanelProps) {
  const t = mapThemeTokens(props.theme);
  return (
    <aside className={`hidden md:flex w-80 shrink-0 flex-col gap-3 border-l p-4 overflow-y-auto ${t.panelBorder} ${t.panel}`}>
      <MapFilterChips {...props} />
      <MapResultCount {...props} />
      <MapResultList {...props} />
    </aside>
  );
}
