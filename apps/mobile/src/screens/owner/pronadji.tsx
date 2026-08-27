import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { WaiterSearchRow } from "@ekonobar/shared/api/venue";
import { colors } from "@ekonobar/shared/design-tokens";
import { useCoverage, useSendInvite, useWaiterSearch, type WaiterFilters } from "@/api/waiter-search";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, TonePill, VerifiedBadge } from "@/ui/primitives";
import { FormField } from "@/ui/form";

/**
 * Pronađi konobara — owner-side talent search.
 *
 * Ranking is by passport score, decided at the DB. There is no purchasable
 * priority placement and none may be added here: a waiter's position is earned.
 *
 * Reach is the waiter's declared `workMunicipalities` — the opštine they will
 * travel to — not where they live. No home coordinates exist to filter on, by
 * design; the question is "will he come", not "where does he sleep".
 */
export default function OwnerPronadjiScreen() {
  const [filters, setFilters] = useState<WaiterFilters>({ available: true });
  const [search, setSearch]   = useState("");

  const { data, isLoading } = useWaiterSearch({ ...filters, search });
  const coverage = useCoverage();
  const invite   = useSendInvite();

  const setFilter = <K extends keyof WaiterFilters>(k: K, v: WaiterFilters[K]) =>
    setFilters(p => ({ ...p, [k]: v }));

  const rows = data?.waiters ?? [];

  const send = (w: WaiterSearchRow) =>
    Alert.alert("Pozvati na razgovor?", w.name ?? "Konobar", [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Pošalji poziv",
        onPress: () => invite.mutate(
          { waiterId: w.id },
          {
            onSuccess: () => Alert.alert("Poziv poslat", `${w.name ?? "Konobar"} će dobiti obaveštenje.`),
            // 409 means a pending invite already exists — that is information,
            // not a failure the owner needs to retry.
            onError: (err: unknown) =>
              Alert.alert("Nije poslato", err instanceof Error ? err.message : "Pokušaj ponovo."),
          },
        ),
      },
    ]);

  return (
    <Screen title="Pronađi konobara">
      <FormField
        label="Pretraga"
        value={search}
        onChangeText={setSearch}
        placeholder="Ime ili prezime"
        autoCapitalize="words"
      />

      <View className="flex-row flex-wrap gap-1.5">
        <FilterChip
          label="Dostupni"
          on={!!filters.available}
          onPress={() => setFilter("available", filters.available ? undefined : true)}
        />
        <FilterChip
          label="Sanitarna ✓"
          on={!!filters.sanitaryBook}
          onPress={() => setFilter("sanitaryBook", filters.sanitaryBook ? undefined : true)}
        />
        <FilterChip
          label="Skor 80+"
          on={filters.minScore === 80}
          onPress={() => setFilter("minScore", filters.minScore === 80 ? undefined : 80)}
        />
        <FilterChip
          label="Verifikovani"
          on={filters.verificationTier === "ID_VERIFIED"}
          onPress={() => setFilter(
            "verificationTier",
            filters.verificationTier === "ID_VERIFIED" ? undefined : "ID_VERIFIED",
          )}
        />
      </View>

      <CoveragePanel
        data={coverage.data ?? []}
        selected={filters.municipality}
        onSelect={m => setFilter("municipality", filters.municipality === m ? undefined : m)}
      />

      {isLoading ? (
        <View className="py-8 items-center"><ActivityIndicator color={colors.primary[500]} /></View>
      ) : rows.length === 0 ? (
        <Empty text="Nema konobara po ovim kriterijumima." />
      ) : (
        <>
          <Text className="text-white/40 text-xs font-normal">
            {data?.total ?? rows.length} rezultata · rangirano po skoru
          </Text>
          {rows.map(w => (
            <WaiterResult key={w.id} waiter={w} busy={invite.isPending} onInvite={() => send(w)} />
          ))}
        </>
      )}
    </Screen>
  );
}

function FilterChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-2"
      style={{
        backgroundColor: on ? colors.primary[500] : "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: on ? colors.primary[500] : colors.shell.border,
      }}
    >
      <Text className="text-[11.5px] font-bold" style={{ color: on ? "#fff" : "rgba(255,255,255,0.65)" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * How many available waiters said they will work in each opština.
 *
 * Aggregate only — no names, no coordinates. A waiter who declared two
 * municipalities counts in both, because this measures "how many will come
 * here", not how the workforce partitions.
 */
function CoveragePanel({ data, selected, onSelect }: {
  data:     { municipality: string; availableCount: number }[];
  selected: string | undefined;
  onSelect: (m: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (data.length === 0) return null;

  const ranked = [...data].sort((a, b) => b.availableCount - a.availableCount);
  const shown  = expanded ? ranked : ranked.slice(0, 5);
  const max    = ranked[0]?.availableCount || 1;

  return (
    <Card>
      <Text className="text-neutral-900 font-bold text-sm mb-2">Pokrivenost po opštini</Text>
      {shown.map(row => {
        const on = selected === row.municipality;
        return (
          <Pressable
            key={row.municipality}
            onPress={() => onSelect(row.municipality)}
            className="py-1.5"
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text
                className="text-[12px] font-semibold"
                style={{ color: on ? colors.primary[600] : "#525252" }}
              >
                {row.municipality}
              </Text>
              <Text className="text-neutral-400 text-[11px] font-bold">{row.availableCount}</Text>
            </View>
            <View className="h-1.5 rounded-full" style={{ backgroundColor: "#f0f0ee" }}>
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.round((row.availableCount / max) * 100)}%`,
                  backgroundColor: on ? colors.primary[500] : "#fdba74",
                }}
              />
            </View>
          </Pressable>
        );
      })}

      {ranked.length > 5 && (
        <Pressable onPress={() => setExpanded(v => !v)} className="items-center pt-2">
          <Text className="text-orange-600 text-[11px] font-bold">
            {expanded ? "Prikaži manje" : `Prikaži svih ${ranked.length}`}
          </Text>
        </Pressable>
      )}

      <Text className="text-neutral-300 text-[10px] mt-2 font-normal text-center">
        Broj dostupnih konobara koji rade u toj opštini
      </Text>
    </Card>
  );
}

function WaiterResult({ waiter: w, busy, onInvite }: {
  waiter: WaiterSearchRow;
  busy: boolean;
  onInvite: () => void;
}) {
  const p = w.waiterPassport;

  return (
    <Card>
      <View className="flex-row items-center gap-2.5">
        <Avatar name={w.name} uri={w.image} size={42} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-[13.5px]">{w.name ?? "Konobar"}</Text>
          <Text className="text-neutral-400 text-[11px] font-normal mt-0.5">
            {p?.yearsExperience ?? 0} god. iskustva · {p?.totalEngagements ?? 0} angažmana
          </Text>
        </View>
        {p && <Text className="text-orange-500 font-black text-lg">{p.score}</Text>}
      </View>

      <View className="flex-row flex-wrap gap-1.5 mt-2">
        <VerifiedBadge tier={w.verificationTier} />
        {p?.currentlyAvailable   && <TonePill tone="green">Dostupan</TonePill>}
        {p?.sanitaryBookValid    && <TonePill tone="blue">Sanitarna ✓</TonePill>}
        {p?.skills.slice(0, 3).map(s => <TonePill key={s} tone="neutral">{s}</TonePill>)}
      </View>

      {!!p?.workMunicipalities.length && (
        <Text className="text-neutral-400 text-[10.5px] font-normal mt-2">
          Radi u: {p.workMunicipalities.join(", ")}
        </Text>
      )}

      <Pressable
        onPress={onInvite}
        disabled={busy}
        className="mt-3 rounded-xl items-center py-2.5"
        style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}
      >
        <Text className="font-bold text-xs" style={{ color: colors.primary[700] }}>
          Pozovi na razgovor
        </Text>
      </Pressable>
    </Card>
  );
}
