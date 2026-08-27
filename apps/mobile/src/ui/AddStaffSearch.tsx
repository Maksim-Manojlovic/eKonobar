import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { WaiterSearchRow } from "@ekonobar/shared/api/venue";
import { colors } from "@ekonobar/shared/design-tokens";
import { useWaiterSearch } from "@/api/waiter-search";
import { FormField } from "./form";
import { Avatar, Empty, TonePill, VerifiedBadge } from "./primitives";

/**
 * Pick a waiter to add to the roster.
 *
 * Results are ordered by passport score at the DB. People already on this
 * roster are filtered out rather than shown and rejected — the server answers
 * a duplicate with 409, which is correct but is a worse thing to discover after
 * filling in a position and a start date.
 */
export function AddStaffSearch({ excludeIds, onPick }: {
  excludeIds: string[];
  onPick:     (waiter: WaiterSearchRow) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useWaiterSearch({ search });

  const exclude = new Set(excludeIds);
  const rows = (data?.waiters ?? []).filter(w => !exclude.has(w.id));

  return (
    <View className="gap-3">
      <FormField
        label="Pretraži konobare"
        value={search}
        onChangeText={setSearch}
        placeholder="Ime ili prezime"
        autoCapitalize="words"
      />

      {isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : rows.length === 0 ? (
        <Empty text={search ? "Nema rezultata." : "Nema dostupnih konobara."} />
      ) : (
        rows.slice(0, 20).map(w => (
          <Pressable
            key={w.id}
            onPress={() => onPick(w)}
            className="flex-row items-center gap-2.5 rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.shell.border }}
          >
            <Avatar name={w.name} uri={w.image} size={36} />
            <View className="flex-1">
              <Text className="text-white font-bold text-[13px]">{w.name ?? "Konobar"}</Text>
              <View className="flex-row flex-wrap gap-1 mt-1">
                <VerifiedBadge tier={w.verificationTier} />
                {w.waiterPassport?.sanitaryBookValid && <TonePill tone="blue">Sanitarna ✓</TonePill>}
                {w.waiterPassport?.currentlyAvailable && <TonePill tone="green">Dostupan</TonePill>}
              </View>
            </View>
            {w.waiterPassport && (
              <Text className="text-orange-400 font-black text-base">
                {w.waiterPassport.score}
              </Text>
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}
