import { Text, View } from "react-native";
import { useIncomingApps, useManagedShifts, useOwnPosts, usePrimaryVenue } from "@/api/venue-queries";
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
  const { venue }   = usePrimaryVenue();
  const posts       = useOwnPosts();
  const apps        = useIncomingApps();
  const shifts      = useManagedShifts();

  const pendingApps     = (apps.data ?? []).filter(a => a.status === "PENDING").length;
  const activePosts     = (posts.data ?? []).filter(p => p.status === "ACTIVE").length;
  const pendingClockIns = (shifts.data ?? [])
    .flatMap(s => s.assignments)
    .filter(a => a.pendingClockIn).length;

  if (!venue) {
    return <Screen title="Pregled"><Empty text="Nemaš registrovan lokal." /></Screen>;
  }

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

      <Card>
        <View className="flex-row justify-around">
          <Stat label="aktivni oglasi" value={activePosts} />
          <Stat label="prijave"        value={apps.data?.length ?? 0} />
          <Stat label="smene"          value={shifts.data?.length ?? 0} />
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
