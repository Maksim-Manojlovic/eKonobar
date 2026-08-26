import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ROLE_LABELS, VERIFICATION_LABELS, isVerified } from "@ekonobar/shared/formatting/labels";
import { apiGet } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Card, Pending, Screen } from "@/ui/Screen";

type MarketInsights = {
  openPositions:     number;
  redAlertCount:     number;
  avgSalaryMin:      number | null;
  avgSalaryMax:      number | null;
  topMunicipalities: string[];
};

/**
 * Pregled — the first screen behind the tab bar.
 *
 * Deliberately small, but it exercises the full stack end to end: a bearer token
 * from SecureStore, an authenticated call to an untouched existing route, a
 * cached TanStack query, and Serbian labels imported from @ekonobar/shared rather
 * than retyped. If this renders, the plumbing works.
 */
export default function PregledScreen() {
  const { user, signOut } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["insights", "market"],
    queryFn:  () => apiGet<MarketInsights>("/api/insights/market"),
  });

  return (
    <Screen title="Pregled" subtitle={user?.name ?? user?.email}>
      <Card>
        <Text className="text-neutral-900 font-bold text-base">{user?.name ?? "—"}</Text>
        <Text className="text-neutral-500 text-xs mt-1">
          {user ? ROLE_LABELS[user.role] ?? user.role : ""}
        </Text>
        {user && (
          <Text className="text-neutral-500 text-xs mt-1">
            {isVerified(user.verificationTier)
              ? VERIFICATION_LABELS[user.verificationTier]
              : "Neverifikovan"}
          </Text>
        )}
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Tržište — sada</Text>
        {isLoading && <Text className="text-neutral-400 text-xs">Učitavanje…</Text>}
        {error && <Text className="text-neutral-400 text-xs">Podaci trenutno nisu dostupni.</Text>}
        {data && (
          <View className="flex-row gap-3">
            <Stat label="otvorene pozicije" value={String(data.openPositions)} />
            <Stat label="red alert" value={String(data.redAlertCount)} accent />
            <Stat
              label="prosek RSD"
              value={
                data.avgSalaryMin && data.avgSalaryMax
                  ? `${data.avgSalaryMin}–${data.avgSalaryMax}`
                  : "—"
              }
            />
          </View>
        )}
      </Card>

      <Pending phase="5" />

      <Pressable onPress={signOut} className="items-center py-3">
        <Text className="text-white/40 text-xs">Odjavi se</Text>
      </Pressable>
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-1 items-center">
      <Text className={accent ? "text-orange-500 font-extrabold" : "text-neutral-900 font-extrabold"}>
        {value}
      </Text>
      <Text className="text-neutral-400 text-[10px] mt-0.5">{label}</Text>
    </View>
  );
}
