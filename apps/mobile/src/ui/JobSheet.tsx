import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { formatSalary, timeAgo } from "@ekonobar/shared/formatting/utils";
import { ENGAGEMENT_LABELS, VENUE_TYPE_ICONS, VENUE_TYPE_ICON_FALLBACK, VENUE_TYPE_LABELS } from "@ekonobar/shared/formatting/labels";
import { colors } from "@ekonobar/shared/design-tokens";
import { useJob } from "@/api/map";
import { useApplyToJob } from "@/api/queries";
import { TonePill } from "./primitives";

/**
 * Job detail, over the map.
 *
 * Opens when a pin is tapped. The geojson feature behind the pin carries only
 * what the marker needs, so the description, tip arrangement and application
 * count are fetched here rather than being stuffed into every feature of a
 * 300-feature response.
 *
 * `hasApplied` comes from the server. Deriving it client-side from the
 * applications list would be wrong the moment the list is paginated or stale.
 */
export function JobSheet({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: job, isLoading, error } = useJob(jobId);
  const apply = useApplyToJob();

  const applied = job?.hasApplied || apply.isSuccess;

  return (
    <View
      className="absolute left-0 right-0 bottom-0 rounded-t-3xl overflow-hidden"
      style={{
        backgroundColor: "#fff",
        maxHeight: "72%",
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
        elevation: 12,
      }}
    >
      {/* Grab handle — signals the sheet is dismissable before anyone tries. */}
      <Pressable onPress={onClose} className="items-center pt-2.5 pb-1">
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4" }} />
      </Pressable>

      {isLoading && (
        <View className="py-10 items-center"><ActivityIndicator color={colors.primary[500]} /></View>
      )}

      {error && (
        <View className="px-5 py-8">
          <Text className="text-neutral-500 text-sm font-normal text-center">
            Detalji oglasa trenutno nisu dostupni.
          </Text>
        </View>
      )}

      {job && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}>
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="text-neutral-900 font-extrabold text-lg">{job.title}</Text>
              <Text className="text-neutral-500 text-xs mt-1 font-normal">
                {job.venue.name}
                {job.venue.municipality ? ` · ${job.venue.municipality}` : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} className="pt-0.5">
              <Text className="text-neutral-400 text-lg font-normal">✕</Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {job.redAlert && <TonePill tone="red">⚡ RED ALERT</TonePill>}
            <TonePill tone="orange">
              {formatSalary({ salaryMin: job.salaryMin, salaryMax: job.salaryMax, engagementType: job.engagementType })}
            </TonePill>
            <TonePill tone="neutral">{ENGAGEMENT_LABELS[job.engagementType] ?? job.engagementType}</TonePill>
            {job.sanitaryRequired && <TonePill tone="blue">Sanitarna obavezna</TonePill>}
          </View>

          {/* Only present for callers the embargo lets see it. */}
          {job.redAlertNote ? (
            <View className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
              <Text className="text-red-700 font-bold" style={{ fontSize: 9 }}>HITNO</Text>
              <Text className="text-neutral-700 text-xs mt-0.5 font-normal">{job.redAlertNote}</Text>
            </View>
          ) : null}

          {job.description ? (
            <View>
              <Text className="text-neutral-900 font-bold text-sm mb-1">Opis</Text>
              <Text className="text-neutral-600 text-xs font-normal" style={{ lineHeight: 18 }}>
                {job.description}
              </Text>
            </View>
          ) : null}

          <View>
            <Text className="text-neutral-900 font-bold text-sm mb-1.5">Lokal</Text>
            <Row label="Tip" value={`${VENUE_TYPE_ICONS[job.venue.venueType] ?? VENUE_TYPE_ICON_FALLBACK} ${VENUE_TYPE_LABELS[job.venue.venueType] ?? job.venue.venueType}`} />
            {job.venue.address && <Row label="Adresa" value={job.venue.address} />}
            {job.venue.trustScore != null && <Row label="Trust score" value={String(Math.round(job.venue.trustScore))} />}
            <Row label="Bakšiš" value={TIP_LABELS[job.tipSystem] ?? job.tipSystem} />
            {job.tipDescription && <Row label="" value={job.tipDescription} />}
          </View>

          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-neutral-400 text-[11px] font-normal">
              {job._count.applications} prijava · objavljen {timeAgo(job.createdAt)}
            </Text>
          </View>

          <Pressable
            onPress={() => apply.mutate(job.id)}
            disabled={applied || apply.isPending}
            className="rounded-2xl items-center py-3.5"
            style={{ backgroundColor: applied ? "#dcfce7" : colors.primary[500] }}
          >
            <Text className="font-bold text-sm" style={{ color: applied ? "#166534" : "#fff" }}>
              {applied ? "✓ Prijavljen" : apply.isPending ? "Šaljem…" : "Prijavi se"}
            </Text>
          </Pressable>

          {apply.error && (
            <Text className="text-red-500 text-[11px] font-normal">{(apply.error as Error).message}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const TIP_LABELS: Record<string, string> = {
  INDIVIDUAL:   "Konobar zadržava svoj bakšiš",
  SHARED:       "Zajednički fond",
  VENUE_POLICY: "Po politici lokala",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-neutral-400 text-xs flex-1 pr-3 font-normal">{label}</Text>
      <Text className="text-neutral-900 text-xs font-semibold flex-[2] text-right">{value}</Text>
    </View>
  );
}
