import { Text, View } from "react-native";
import {
  VENUE_TYPE_ICONS,
  VENUE_TYPE_ICON_FALLBACK,
  VENUE_TYPE_LABELS,
} from "@ekonobar/shared/formatting/labels";
import { usePrimaryVenue } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, ScoreRing, TonePill } from "@/ui/primitives";

/**
 * Profil lokala — the owner's fifth tab.
 *
 * Shares the `passport` route with the waiter's Waiter Passport: one route file
 * dispatches on role, so the tab bar keeps five stable slots for both.
 */
export default function OwnerProfileScreen() {
  const { venue, isLoading } = usePrimaryVenue();

  if (isLoading) return <Screen title="Profil"><Empty text="Učitavanje…" /></Screen>;
  if (!venue)    return <Screen title="Profil"><Empty text="Nemaš registrovan lokal." /></Screen>;

  const typeLabel = VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType;
  const typeIcon  = VENUE_TYPE_ICONS[venue.venueType] ?? VENUE_TYPE_ICON_FALLBACK;

  return (
    <Screen title="Profil" subtitle={venue.name}>
      <Card>
        <View className="items-center gap-2">
          <ScoreRing score={venue.trustScore ?? 0} size={88} label="TRUST" />
          <Text className="text-neutral-900 font-bold text-base">{venue.name}</Text>
          <Text className="text-neutral-400 text-xs font-normal">
            {venue.address}{" · "}{venue.municipality}
          </Text>
          <View className="flex-row gap-1.5">
            <TonePill tone="orange">{typeIcon}{" "}{typeLabel}</TonePill>
            <TonePill tone={venue.isActive ? "green" : "neutral"}>
              {venue.isActive ? "Aktivan" : "Neaktivan"}
            </TonePill>
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Podaci</Text>
        <Row label="Opština" value={venue.municipality} />
        <Row label="Adresa"  value={venue.address} />
        <Row label="Tip"     value={typeLabel} />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-neutral-400 text-xs font-normal">{label}</Text>
      <Text className="text-neutral-900 text-xs font-semibold">{value ?? "—"}</Text>
    </View>
  );
}
