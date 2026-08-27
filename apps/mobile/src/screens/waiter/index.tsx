import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, type Region } from "react-native-maps";
import { DEFAULT_CITY } from "@ekonobar/shared/geo/cities";
import { formatSalary } from "@ekonobar/shared/formatting/utils";
import { ENGAGEMENT_LABELS } from "@ekonobar/shared/formatting/labels";
import { colors } from "@ekonobar/shared/design-tokens";
import { useJobsGeoJson, type BBox, type JobFeature, type MapFilters } from "@/api/map";
import { useApplyToJob } from "@/api/queries";
import { TonePill } from "@/ui/primitives";
import { JobSheet } from "@/ui/JobSheet";

/**
 * Pregled — jobs on a map, matching the web marketplace.
 *
 * Filters are query parameters, never a .filter() on the response: the endpoint
 * caps at 300 features, so filtering client-side would filter an already
 * truncated page and under-report. Panning refetches for the new bbox.
 *
 * No device location in v1 (mobile-app-plan §2), so the map opens on
 * DEFAULT_CITY from the shared geo constants — the same source the web map uses
 * for its initial viewport — rather than asking to follow the user.
 */

const CHIPS: Array<{ label: string; patch: MapFilters }> = [
  { label: "Stalno",         patch: { engagementType: "FULL_TIME" } },
  { label: "Sezonski",       patch: { engagementType: "SEASONAL" } },
  { label: "Vikend",         patch: { engagementType: "WEEKEND" } },
  { label: "Slavlje",        patch: { engagementType: "CELEBRATION" } },
  { label: "Red Alert",      patch: { redAlert: true } },
  { label: "Bez sanitarne",  patch: { sanitaryRequired: false } },
];

/** Same colour per engagement type as the web legend. */
const TYPE_COLOR: Record<string, string> = {
  FULL_TIME:   "#3b82f6",
  SEASONAL:    "#14b8a6",
  WEEKEND:     "#a855f7",
  CELEBRATION: "#ec4899",
};
const RED_ALERT_COLOR = "#ef4444";

function regionToBBox(r: Region): BBox {
  return {
    swLat: r.latitude  - r.latitudeDelta  / 2,
    swLng: r.longitude - r.longitudeDelta / 2,
    neLat: r.latitude  + r.latitudeDelta  / 2,
    neLng: r.longitude + r.longitudeDelta / 2,
  };
}

const INITIAL_REGION: Region = {
  latitude:       DEFAULT_CITY.center.latitude,
  longitude:      DEFAULT_CITY.center.longitude,
  // Roughly the web map's zoom 12 over Belgrade. Deltas rather than a zoom level
  // because react-native-maps describes a viewport by span, not by tile zoom.
  latitudeDelta:  0.14,
  longitudeDelta: 0.14,
};

export default function PregledScreen() {
  const [bbox, setBBox]       = useState<BBox | null>(regionToBBox(INITIAL_REGION));
  const [filters, setFilters] = useState<MapFilters>({});
  const [selected, setSelected] = useState<string | null>(null);

  // Panning fires continuously; only the settled region is worth a request.
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegionChangeComplete = (r: Region) => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setBBox(regionToBBox(r)), 250);
  };

  const { data, isFetching } = useJobsGeoJson(bbox, filters);
  const features = useMemo(() => data?.features ?? [], [data]);

  const toggle = (patch: MapFilters) => {
    setFilters(prev => {
      const key = Object.keys(patch)[0] as keyof MapFilters;
      const on  = prev[key] === patch[key];
      const next = { ...prev };
      if (on) delete next[key];
      else Object.assign(next, patch);
      return next;
    });
  };

  const isOn = (patch: MapFilters) => {
    const key = Object.keys(patch)[0] as keyof MapFilters;
    return filters[key] === patch[key];
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
        <Text className="text-white text-[23px] font-black">Poslovi na mapi</Text>
        {isFetching && <ActivityIndicator color={colors.primary[500]} />}
      </View>

      <View className="pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {CHIPS.map(c => {
            const on = isOn(c.patch);
            return (
              <Pressable
                key={c.label}
                onPress={() => toggle(c.patch)}
                className="rounded-full px-3 py-2"
                style={{
                  backgroundColor: on ? colors.primary[500] : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: on ? colors.primary[500] : colors.shell.border,
                }}
              >
                <Text
                  className="text-[11.5px] font-bold"
                  style={{ color: on ? "#fff" : "rgba(255,255,255,0.65)" }}
                >
                  {c.label === "Red Alert" ? "⚡ Red Alert" : c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-1 mx-4 rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.shell.border }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={INITIAL_REGION}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={() => setSelected(null)}
          showsPointsOfInterest={false}
          toolbarEnabled={false}
        >
          {features.map(f => (
            <Marker
              key={f.properties.id}
              // GeoJSON is [lng, lat]; a Marker wants them the other way round.
              coordinate={{ latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] }}
              pinColor={f.properties.redAlert ? RED_ALERT_COLOR : (TYPE_COLOR[f.properties.engagementType] ?? colors.primary[500])}
              onPress={() => setSelected(f.properties.id)}
            />
          ))}
        </MapView>
      </View>

      <View className="px-5 pt-3 pb-1">
        <Text className="text-white/60 text-xs font-semibold">
          {features.length} {features.length === 1 ? "oglas" : "oglasa"} u ovom području
        </Text>
      </View>

      <ScrollView className="max-h-72" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
        {features.length === 0 && !isFetching && (
          <Text className="text-white/40 text-xs font-normal py-4 text-center">
            Nema oglasa u ovom području. Pomeri mapu ili skloni filtere.
          </Text>
        )}
        {features.map(f => (
          <JobRow
            key={f.properties.id}
            feature={f}
            highlighted={selected === f.properties.id}
            onOpen={() => setSelected(f.properties.id)}
          />
        ))}
      </ScrollView>

      {/* Last child so it overlays the map and the list. */}
      {selected && <JobSheet jobId={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
}

function JobRow({ feature, highlighted, onOpen }: { feature: JobFeature; highlighted: boolean; onOpen: () => void }) {
  const p = feature.properties;
  const apply = useApplyToJob();
  const stripe = p.redAlert ? RED_ALERT_COLOR : (TYPE_COLOR[p.engagementType] ?? colors.primary[500]);

  return (
    <Pressable
      onPress={onOpen}
      className="bg-white rounded-2xl flex-row overflow-hidden"
      style={{
        borderWidth: highlighted ? 2 : 1,
        borderColor: highlighted ? colors.primary[500] : "#f0efec",
      }}
    >
      {/* The web cards carry a coloured left stripe per engagement type. */}
      <View style={{ width: 4, backgroundColor: stripe }} />
      <View className="flex-1 p-3.5">
        <View className="flex-row items-start justify-between">
          <Text className="text-neutral-900 font-bold text-sm flex-1 pr-2">{p.title}</Text>
          {p.redAlert && <TonePill tone="red">RED ALERT</TonePill>}
        </View>

        <Text className="text-neutral-400 text-xs mt-0.5 font-normal">
          {p.venue.name}{p.venue.municipality ? ` · ${p.venue.municipality}` : ""}
        </Text>

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-neutral-900 font-bold text-xs">
            {formatSalary({ salaryMin: p.salaryMin, salaryMax: p.salaryMax, engagementType: p.engagementType })}
          </Text>
          <Pressable
            onPress={() => apply.mutate(p.id)}
            disabled={apply.isPending || apply.isSuccess}
            className="rounded-xl px-3 py-2"
            style={{ backgroundColor: apply.isSuccess ? "#dcfce7" : colors.primary[500] }}
          >
            <Text
              className="font-bold text-[11px]"
              style={{ color: apply.isSuccess ? "#166534" : "#fff" }}
            >
              {apply.isSuccess ? "✓ Prijavljen" : apply.isPending ? "…" : "Prijavi se"}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-1.5 mt-2">
          <TonePill tone="neutral">{ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType}</TonePill>
          {p.sanitaryRequired && <TonePill tone="blue">Sanitarna obavezna</TonePill>}
        </View>

        {apply.error && (
          <Text className="text-red-500 text-[11px] mt-2 font-normal">{(apply.error as Error).message}</Text>
        )}
      </View>
    </Pressable>
  );
}
