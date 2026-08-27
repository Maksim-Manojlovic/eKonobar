import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { PassportData } from "@ekonobar/shared/api/waiter";
import { usePassport, useSetAvailability } from "@/api/queries";
import { pickImage, uploadAsset, useSetProfilePhoto } from "@/api/upload";
import { SanitaryCard } from "@/ui/SanitaryCard";
import { useAuth } from "@/auth/AuthProvider";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, ScoreRing, TonePill, VerifiedBadge } from "@/ui/primitives";

/**
 * Waiter Passport™.
 *
 * Two things the design prototype showed are deliberately absent:
 *
 *   - the BRONZE→PLATINUM ladder and its "Gold → Platinum, 127/150" progress bar.
 *     Those values are not in VerificationTier, and the tier is evidence, not a
 *     rank — so verification renders as a binary badge naming what was proven.
 *   - the FREE / PRO 290 / PRO+ 490 pricing row and the "WhatsApp uz PRO" gates.
 *     The waiter subscription was removed from the platform; every channel is
 *     free and opt-in. Do not reintroduce either.
 */
export default function PassportScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const setAvailable = useSetAvailability();
  const setPhoto = useSetProfilePhoto();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { data, isLoading, error } = usePassport();

  if (isLoading) return <Screen title="Waiter Passport™"><Loading /></Screen>;
  if (error || !data) {
    return <Screen title="Waiter Passport™"><Empty text="Pasoš trenutno nije dostupan." /></Screen>;
  }

  return (
    <Screen title="Waiter Passport™" subtitle={user?.name ?? undefined}>
      <Card>
        <View className="items-center gap-2">
          <View className="flex-row items-center gap-5">
          <Pressable
            onPress={async () => {
              setPhotoError(null);
              setPhotoBusy(true);
              try {
                const asset = await pickImage();
                if (!asset) return;
                const url = await uploadAsset(asset, "avatar");
                await setPhoto.mutateAsync(url);
              } catch (err) {
                setPhotoError(err instanceof Error ? err.message : "Otpremanje nije uspelo.");
              } finally {
                setPhotoBusy(false);
              }
            }}
            className="items-center"
          >
            <Avatar name={user?.name} uri={data.profilePhoto} size={72} round />
            <Text className="text-orange-500 text-[10.5px] font-bold mt-1">
              {photoBusy ? "Otpremam…" : data.profilePhoto ? "Promeni sliku" : "Dodaj sliku"}
            </Text>
          </Pressable>
          <ScoreRing score={data.score} size={92} />
          </View>
          {photoError && (
            <Text className="text-red-500 text-[11px] font-normal">{photoError}</Text>
          )}
          <Text className="text-neutral-900 font-bold text-base">{user?.name ?? "—"}</Text>
          <View className="flex-row flex-wrap gap-1.5 justify-center">
            {user && <VerifiedBadge tier={user.verificationTier} />}
            <TonePill tone={data.currentlyAvailable ? "green" : "neutral"}>
              {data.currentlyAvailable ? "Dostupan" : "Zauzet"}
            </TonePill>
            {data.sanitaryBookValid && <TonePill tone="blue">Sanitarna ✓</TonePill>}
          </View>
        </View>

        <View className="flex-row justify-around mt-4">
          <Stat label="Recenzije"     value={data.reviewCount} />
          <Stat label="Angažmani"     value={data.totalEngagements} />
          <Stat label="God. iskustva" value={data.yearsExperience} />
        </View>
      </Card>

      {data.trustScore && (
        <Card>
          <Text className="text-neutral-900 font-bold mb-3">Dimenzije skora</Text>
          <Dim label="Tačnost"      value={data.trustScore.punctuality} />
          <Dim label="Veštine"      value={data.trustScore.skill} />
          <Dim label="Komunikacija" value={data.trustScore.guestCommunication} />
          <Dim label="Higijena"     value={data.trustScore.personalHygiene} />
          <Dim label="Tim"          value={data.trustScore.teamwork} />
          <Dim label="Brzina"       value={data.trustScore.speed} />
          <Text className="text-neutral-400 text-[10px] mt-2 font-normal">
            Na osnovu {data.trustScore.sampleSize} recenzija.
          </Text>
        </Card>
      )}

      <SanitaryCard />

      <Skills data={data} />
      <Reach data={data} />

      {/* Availability is what decides whether this waiter appears in owner
          search at all, so it belongs on the passport rather than buried in
          settings. */}
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-neutral-900 font-bold text-sm">Dostupan za smene</Text>
            <Text className="text-neutral-400 text-[11px] mt-0.5 font-normal">
              Isključeno te sklanja iz pretrage lokala.
            </Text>
          </View>
          <Switch
            value={data.currentlyAvailable}
            disabled={setAvailable.isPending}
            onValueChange={v => setAvailable.mutate(v)}
            trackColor={{ false: "#e5e5e3", true: "#f97316" }}
          />
        </View>
      </Card>

      <Pressable onPress={() => router.push("/settings")} className="items-center py-4">
        <Text className="text-white/50 text-xs font-semibold">Podešavanja →</Text>
      </Pressable>
    </Screen>
  );
}

function Skills({ data }: { data: PassportData }) {
  if (!data.skills.length && !data.languages.length) return null;
  return (
    <Card>
      <Text className="text-neutral-900 font-bold mb-2">Veštine i jezici</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {data.skills.map(s => <TonePill key={s} tone="neutral">{s}</TonePill>)}
        {data.languages.map(l => <TonePill key={l} tone="blue">{l}</TonePill>)}
      </View>
    </Card>
  );
}

function Reach({ data }: { data: PassportData }) {
  if (!data.workMunicipalities.length) return null;
  return (
    <Card>
      <Text className="text-neutral-900 font-bold mb-1">Gde radiš</Text>
      <Text className="text-neutral-400 text-[11px] mb-2 font-normal">
        Opštine u kojima prihvataš smene.
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {data.workMunicipalities.map(m => <TonePill key={m} tone="orange">{m}</TonePill>)}
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center">
      <Text className="text-neutral-900 font-extrabold text-base">{value}</Text>
      <Text className="text-neutral-400 text-[10px] font-normal">{label}</Text>
    </View>
  );
}

function Dim({ label, value }: { label: string; value: number }) {
  return (
    <View className="mb-2.5">
      <View className="flex-row justify-between mb-1">
        <Text className="text-neutral-600 text-xs font-semibold">{label}</Text>
        <Text className="text-neutral-900 text-xs font-bold">{Math.round(value)}</Text>
      </View>
      <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f0efec" }}>
        <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: "#f97316" }} />
      </View>
    </View>
  );
}

function Loading() {
  return <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>;
}
