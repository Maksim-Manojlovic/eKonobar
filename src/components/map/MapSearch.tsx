"use client";

import { useState, useCallback, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import RedAlertPulse from "./RedAlertPulse";
import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BELGRADE = { longitude: 20.4633, latitude: 44.8176, zoom: 12 };

interface JobProps {
  id:               string;
  title:            string;
  engagementType:   string;
  salaryMin:        number | null;
  salaryMax:        number | null;
  sanitaryRequired: boolean;
  redAlert:         boolean;
  venue: { id: string; name: string; municipality: string | null };
}

interface VenueProps {
  id:           string;
  name:         string;
  venueType:    string | null;
  municipality: string | null;
  trustScore:   number | null;
  activeJobs:   number;
}

type GeoFeature<P> = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
};

interface BBox { swLat: number; swLng: number; neLat: number; neLng: number }

export interface Props {
  mode: "jobs" | "venues";
  className?: string;
}

export default function MapSearch({ mode, className = "" }: Props) {
  const mapRef     = useRef<MapRef>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [jobFeatures,   setJobFeatures]   = useState<GeoFeature<JobProps>[]>([]);
  const [venueFeatures, setVenueFeatures] = useState<GeoFeature<VenueProps>[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedJob,   setSelectedJob]   = useState<GeoFeature<JobProps> | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<GeoFeature<VenueProps> | null>(null);

  const [engagementFilter, setEngagementFilter] = useState("");
  const [redAlertOnly,     setRedAlertOnly]     = useState(false);
  const [sanitaryFree,     setSanitaryFree]     = useState(false);
  const [venueTypeFilter,  setVenueTypeFilter]  = useState("");

  const fetchFeatures = useCallback(async (bbox: BBox) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        swLat: String(bbox.swLat), swLng: String(bbox.swLng),
        neLat: String(bbox.neLat), neLng: String(bbox.neLng),
      });
      const url = mode === "jobs" ? `/api/jobs/geojson?${p}` : `/api/venues/geojson?${p}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const fc = await res.json();
      if (mode === "jobs") setJobFeatures(fc.features ?? []);
      else                 setVenueFeatures(fc.features ?? []);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const scheduleFetch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFeatures({
        swLat: bounds.getSouth(), swLng: bounds.getWest(),
        neLat: bounds.getNorth(), neLng: bounds.getEast(),
      });
    }, 500);
  }, [fetchFeatures]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 rounded-2xl min-h-[400px] ${className}`}>
        <p className="text-sm text-neutral-400">Mapbox token nije konfigurisan.</p>
      </div>
    );
  }

  const visibleJobs = mode === "jobs" ? jobFeatures.filter((f) => {
    if (redAlertOnly && !f.properties.redAlert) return false;
    if (sanitaryFree && f.properties.sanitaryRequired) return false;
    if (engagementFilter && f.properties.engagementType !== engagementFilter) return false;
    return true;
  }) : [];

  const visibleVenues = mode === "venues" ? venueFeatures.filter((f) => {
    if (venueTypeFilter && f.properties.venueType !== venueTypeFilter) return false;
    return true;
  }) : [];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Filter chips */}
      {mode === "jobs" && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(ENGAGEMENT_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setEngagementFilter(v => v === value ? "" : value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                engagementFilter === value
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setRedAlertOnly(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              redAlertOnly
                ? "bg-red-500 text-white border-red-500"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-red-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${redAlertOnly ? "bg-white" : "bg-red-500"}`} />
            Red Alert
          </button>
          <button
            onClick={() => setSanitaryFree(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              sanitaryFree
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
            }`}
          >
            Bez sanitarne
          </button>
        </div>
      )}

      {mode === "venues" && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setVenueTypeFilter(v => v === value ? "" : value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                venueTypeFilter === value
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-neutral-200" style={{ height: 520 }}>
        {loading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm pointer-events-none">
            <p className="text-xs font-bold text-neutral-500">Učitavam...</p>
          </div>
        )}

        <Map
          ref={mapRef}
          initialViewState={BELGRADE}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          style={{ width: "100%", height: "100%" }}
          onMoveEnd={scheduleFetch}
          onLoad={scheduleFetch}
        >
          <NavigationControl position="top-right" />

          {visibleJobs.map((f) => (
            <Marker
              key={f.properties.id}
              longitude={f.geometry.coordinates[0]}
              latitude={f.geometry.coordinates[1]}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedJob(f);
                setSelectedVenue(null);
              }}
            >
              {f.properties.redAlert ? (
                <RedAlertPulse />
              ) : (
                <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform" />
              )}
            </Marker>
          ))}

          {visibleVenues.map((f) => (
            <Marker
              key={f.properties.id}
              longitude={f.geometry.coordinates[0]}
              latitude={f.geometry.coordinates[1]}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedVenue(f);
                setSelectedJob(null);
              }}
            >
              <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform" />
            </Marker>
          ))}

          {selectedJob && (
            <Popup
              longitude={selectedJob.geometry.coordinates[0]}
              latitude={selectedJob.geometry.coordinates[1]}
              anchor="bottom"
              onClose={() => setSelectedJob(null)}
              closeOnClick={false}
              maxWidth="260px"
            >
              <div className="p-1 flex flex-col gap-1.5">
                {selectedJob.properties.redAlert && (
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-wide">Red Alert</span>
                )}
                <p className="text-sm font-black text-neutral-900 leading-tight">
                  {selectedJob.properties.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {selectedJob.properties.venue.name}
                  {selectedJob.properties.venue.municipality && ` · ${selectedJob.properties.venue.municipality}`}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-2 py-0.5 font-bold">
                    {ENGAGEMENT_LABELS[selectedJob.properties.engagementType] ?? selectedJob.properties.engagementType}
                  </span>
                  {(selectedJob.properties.salaryMin || selectedJob.properties.salaryMax) && (
                    <span className="text-[10px] text-neutral-600 font-bold">
                      {selectedJob.properties.salaryMin && selectedJob.properties.salaryMax
                        ? `${selectedJob.properties.salaryMin}–${selectedJob.properties.salaryMax} RSD`
                        : `${selectedJob.properties.salaryMin ?? selectedJob.properties.salaryMax} RSD`}
                    </span>
                  )}
                </div>
                <Link
                  href={`/jobs/${selectedJob.properties.id}`}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 mt-0.5"
                >
                  Pogledaj oglas →
                </Link>
              </div>
            </Popup>
          )}

          {selectedVenue && (
            <Popup
              longitude={selectedVenue.geometry.coordinates[0]}
              latitude={selectedVenue.geometry.coordinates[1]}
              anchor="bottom"
              onClose={() => setSelectedVenue(null)}
              closeOnClick={false}
              maxWidth="240px"
            >
              <div className="p-1 flex flex-col gap-1.5">
                <p className="text-sm font-black text-neutral-900 leading-tight">
                  {selectedVenue.properties.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {VENUE_TYPE_LABELS[selectedVenue.properties.venueType ?? ""] ?? selectedVenue.properties.venueType}
                  {selectedVenue.properties.municipality && ` · ${selectedVenue.properties.municipality}`}
                </p>
                {selectedVenue.properties.trustScore != null && (
                  <p className="text-[10px] text-neutral-600 font-bold">
                    Poverenje: {Math.round(selectedVenue.properties.trustScore)}/100
                  </p>
                )}
                {selectedVenue.properties.activeJobs > 0 && (
                  <p className="text-[10px] text-orange-600 font-bold">
                    {selectedVenue.properties.activeJobs} aktivnih oglasa
                  </p>
                )}
                <Link
                  href={`/venues/${selectedVenue.properties.id}`}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 mt-0.5"
                >
                  Pogledaj lokal →
                </Link>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
