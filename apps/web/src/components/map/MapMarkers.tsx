"use client";

import { Marker } from "react-map-gl/mapbox";
import RedAlertPulse from "./RedAlertPulse";
import { isJob, markerColor, CLUSTER_COLOR } from "./map-constants";
import type { MapProps } from "./map-types";
import type { MapState } from "./useMapState";

/**
 * A single feature's pin. Red Alert jobs pulse red (their urgency overrides the
 * category color); everything else is a disc tinted by its type — venueType for
 * venues, engagementType for jobs — so the map reads as a legend at a glance.
 */
function MarkerBody({ p, isSel, isHov }: { p: MapProps; isSel: boolean; isHov: boolean }) {
  const scale = isSel ? "scale-150" : isHov ? "scale-125" : "";

  if (isJob(p) && p.redAlert) {
    return (
      <div className={`transition-transform ${scale}`}>
        <RedAlertPulse />
      </div>
    );
  }

  return (
    <div
      className={`w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-125 ${scale}`}
      style={{ backgroundColor: markerColor(p) }}
    />
  );
}

/**
 * Cluster + feature markers.
 *
 * Clustering is what makes the map readable: Belgrade returns up to 300 features
 * and un-clustered pins overlap into an orange smear at city zoom. A cluster
 * marker zooms to the level that breaks it apart; a leaf opens its popup.
 */
export function ClusterMarkers({
  clusters, supercluster, mapRef, selectedId, hoveredId, onOpenMarker, onHover,
}: {
  clusters:     MapState["clusters"];
  supercluster: MapState["supercluster"];
  mapRef:       MapState["mapRef"];
  selectedId:   string | null;
  hoveredId:    string | null;
  onOpenMarker: (p: MapProps, lng: number, lat: number) => void;
  onHover:      (id: string | null) => void;
}) {
  return (
    <>
      {clusters.map((cluster) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cp = cluster.properties as any;
        const [lng, lat] = cluster.geometry.coordinates as [number, number];

        if (cp.cluster === true) {
          const count = Number(cp.point_count);
          // Scale the disc with the count so dense areas read at a glance.
          const size = count < 10 ? 34 : count < 50 ? 42 : 50;
          return (
            <Marker
              key={`cluster-${String(cp.cluster_id)}`}
              longitude={lng}
              latitude={lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (!supercluster) return;
                const z = Math.min(
                  supercluster.getClusterExpansionZoom(Number(cp.cluster_id)),
                  20,
                );
                mapRef.current?.flyTo({ center: [lng, lat], zoom: z, duration: 500 });
              }}
            >
              <div
                className="flex items-center justify-center rounded-full border-2 border-white text-white font-black shadow-lg cursor-pointer transition-transform hover:scale-110"
                style={{ width: size, height: size, fontSize: count < 50 ? 12 : 13, backgroundColor: CLUSTER_COLOR }}
              >
                {count}
              </div>
            </Marker>
          );
        }

        const p = cp as MapProps;
        return (
          <Marker
            key={p.id}
            longitude={lng}
            latitude={lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onOpenMarker(p, lng, lat);
            }}
          >
            <div
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
            >
              <MarkerBody p={p} isSel={p.id === selectedId} isHov={p.id === hoveredId} />
            </div>
          </Marker>
        );
      })}
    </>
  );
}
