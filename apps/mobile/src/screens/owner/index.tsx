import { Text, View } from "react-native";
import { useBootstrap } from "@/api/bootstrap";
import { Card, Screen } from "@/ui/Screen";
import { Empty, ScoreRing, TonePill } from "@/ui/primitives";

/**
 * Owner Pregled.
 *
 * Deliberately an action inbox rather than a dashboard: the numbers worth a phone
 * screen are the ones that need a decision today. Charts stay on the web —
 * recharts has no React Native build, and a trend line is not what an owner opens
 * their phone for mid-service.
 */
export default function OwnerHomeScreen() {
  // One request carries the whole header and every counter below it. The lists
  // themselves are not fetched here — this screen only ever showed counts of
  // them, so pulling three full lists to call .length on them was the cost of
  // not having an endpoint that counts.
  const { data, isLoading } = useBootstrap();
  const b = data?.owner;
  const venue = b?.venue ?? null;

  if (isLoading) {
    return <Screen title="Pregled"><Empty text="Učitavanje…" /></Screen>;
  }
  if (!venue) {
    return <Screen title="Pregled"><Empty text="Nemaš registrovan lokal." /></Screen>;
  }

  const pendingApps     = b?.pendingApplications ?? 0;
  const activePosts     = b?.activePosts ?? 0;
  const pendingClockIns = b?.pendingClockIns ?? 0;
  const pendingLeave    = b?.pendingLeaveRequests ?? 0;

  return (
    <Screen title="Pregled" subtitle={venue.name}>
      <Card>
        <View className="flex-row items-center gap-4">
          <ScoreRing score={venue.trustScore ?? 0} size={72} label="TRUST" />
          <View className="flex-1">
            <Text className="text-neutral-900 font-bold text-sm">{venue.name}</Text>
            <Text className="text-neutral-400 text-xs mt-0.5 font-normal">{venue.municipality}</Text>
            <View className="flex-row gap-1.5 mt-2">
              <TonePill tone={venue.isActive ? "green" : "neutral"}>
                {venue.isActive ? "Aktivan" : "Neaktivan"}
              </TonePill>
            </View>
          </View>
        </View>
      </Card>

      {/* Pinned above everything else: in v1 every mobile clock-in needs this. */}
      {pendingClockIns > 0 && (
        <Card>
          <Text className="text-neutral-900 font-bold">
            {pendingClockIns} {pendingClockIns === 1 ? "dolazak čeka" : "dolazaka čeka"} odobrenje
          </Text>
          <Text className="text-neutral-400 text-[11px] mt-1 font-normal">
            Otvori Smene da odobriš ili odbiješ.
          </Text>
        </Card>
      )}

      {pendingApps > 0 && (
        <Card>
          <Text className="text-neutral-900 font-bold">{pendingApps} prijava čeka odgovor</Text>
          <Text className="text-neutral-400 text-[11px] mt-1 font-normal">Otvori Posao, pa Prijave.</Text>
        </Card>
      )}

      {pendingLeave > 0 && (
        <Card>
          <Text className="text-neutral-900 font-bold">
            {pendingLeave} {pendingLeave === 1 ? "zahtev za odmor" : "zahteva za odmor"} čeka odluku
          </Text>
          <Text className="text-neutral-400 text-[11px] mt-1 font-normal">
            Otvori Smene, pa Odmori.
          </Text>
        </Card>
      )}

      <Card>
        <View className="flex-row justify-around">
          <Stat label="aktivni oglasi" value={activePosts} />
          <Stat label="prijave"        value={pendingApps} />
          <Stat label="odmori"         value={pendingLeave} />
        </View>
      </Card>

    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center">
      <Text className="text-neutral-900 font-extrabold text-lg">{value}</Text>
      <Text className="text-neutral-400 text-[10px] mt-0.5 font-normal">{label}</Text>
    </View>
  );
}
