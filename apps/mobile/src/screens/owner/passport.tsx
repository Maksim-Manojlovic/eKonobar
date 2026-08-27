import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  VENUE_TYPE_ICONS,
  VENUE_TYPE_ICON_FALLBACK,
  VENUE_TYPE_LABELS,
} from "@ekonobar/shared/formatting/labels";
import { usePrimaryVenue, useSetVenueLogo } from "@/api/venue-queries";
import { pickImage, uploadAsset } from "@/api/upload";
import { VenuePhotos } from "@/ui/VenuePhotos";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, ScoreRing, TonePill } from "@/ui/primitives";

/**
 * Profil lokala — the owner's fifth tab.
 *
 * Shares the `passport` route with the waiter's Waiter Passport: one route file
 * dispatches on role, so the tab bar keeps five stable slots for both.
 */
export default function OwnerProfileScreen() {
  const router = useRouter();
  const { venue, isLoading } = usePrimaryVenue();
  const setLogo = useSetVenueLogo();
  const [logoBusy, setLogoBusy]   = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  if (isLoading) return <Screen title="Profil"><Empty text="Učitavanje…" /></Screen>;
  if (!venue)    return <Screen title="Profil"><Empty text="Nemaš registrovan lokal." /></Screen>;

  const typeLabel = VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType;
  const typeIcon  = VENUE_TYPE_ICONS[venue.venueType] ?? VENUE_TYPE_ICON_FALLBACK;

  return (
    <Screen title="Profil" subtitle={venue.name}>
      <Card>
        <View className="items-center gap-2">
          <View className="flex-row items-center gap-5">
          <Pressable
            onPress={async () => {
              setLogoError(null);
              setLogoBusy(true);
              try {
                const asset = await pickImage();
                if (!asset) return;
                const url = await uploadAsset(asset, "avatar");
                await setLogo.mutateAsync({ venueId: venue.id, logo: url });
              } catch (err) {
                setLogoError(err instanceof Error ? err.message : "Otpremanje nije uspelo.");
              } finally {
                setLogoBusy(false);
              }
            }}
            className="items-center"
          >
            <Avatar name={venue.name} uri={venue.logo} size={68} round />
            <Text className="text-orange-500 text-[10.5px] font-bold mt-1">
              {logoBusy ? "Otpremam…" : venue.logo ? "Promeni logo" : "Dodaj logo"}
            </Text>
          </Pressable>
          <ScoreRing score={venue.trustScore ?? 0} size={88} label="TRUST" />
          </View>
          {logoError && <Text className="text-red-500 text-[11px] font-normal">{logoError}</Text>}
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

      <VenuePhotos venueId={venue.id} images={venue.images ?? []} />

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Podaci</Text>
        <Row label="Opština" value={venue.municipality} />
        <Row label="Adresa"  value={venue.address} />
        <Row label="Tip"     value={typeLabel} />
      </Card>

      <Pressable onPress={() => router.push("/settings")} className="items-center py-4">
        <Text className="text-white/50 text-xs font-semibold">Podešavanja →</Text>
      </Pressable>
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
