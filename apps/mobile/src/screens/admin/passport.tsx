import { ActivityIndicator, Text, View } from "react-native";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import { useSystemHealth } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, TonePill } from "@/ui/primitives";

/**
 * Admin — system health.
 *
 * The point of this screen is the cron heartbeat. If publish-reviews stops
 * running, reviews silently never go live and scores stop moving; nothing else
 * in the product surfaces that. Everything here is a read, refreshed every 60s.
 *
 * Deliberately does not report on the removed waiter subscription — the web
 * version carried two rows for it long after the route stopped returning the
 * field, which is what made that card crash.
 */
export default function AdminHealthScreen() {
  const { data, isLoading, error } = useSystemHealth();

  if (isLoading) {
    return <Screen title="Sistem"><View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View></Screen>;
  }
  if (error || !data) {
    return <Screen title="Sistem"><Empty text="Zdravlje sistema trenutno nije dostupno." /></Screen>;
  }

  const overdue = data.reviews.overdueGuest + data.reviews.overdueRegular;

  return (
    <Screen title="Sistem">
      <Card>
        <View className="flex-row items-center justify-between">
          <Text className="text-neutral-900 font-bold">Status</Text>
          <TonePill tone={overdue === 0 ? "green" : "orange"}>
            {overdue === 0 ? "✓ Sve OK" : "Pažnja"}
          </TonePill>
        </View>
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Cron</Text>
        <Row
          label="Poslednja objava recenzije"
          value={data.cron.lastPublishedReviewAt ? timeAgo(data.cron.lastPublishedReviewAt) : "Nikad"}
          bad={!data.cron.lastPublishedReviewAt}
        />
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Recenzije</Text>
        <Row label="Zakasnele gost (>2h)"  value={String(data.reviews.overdueGuest)}   bad={data.reviews.overdueGuest > 0} />
        <Row label="Zakasnele ostale (>48h)" value={String(data.reviews.overdueRegular)} bad={data.reviews.overdueRegular > 0} />
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Sistem</Text>
        <Row label="Dolasci na čekanju" value={String(data.system.pendingClockIns)} />
        <Row label="Obrisani korisnici" value={String(data.users.softDeleted)} />
        <Row label="Rate-limit zapisi"  value={String(data.system.rateLimitEntries)} />
      </Card>

      <Card>
        <Text className="text-neutral-900 font-bold mb-2">Infrastruktura</Text>
        <Row
          label="Redis"
          value={data.redis ? (data.redis.connected ? `${data.redis.latencyMs ?? "?"} ms` : "Nedostupan") : "Nije podešen"}
          bad={Boolean(data.redis && !data.redis.connected)}
        />
        <Row
          label="Baza"
          value={data.db?.pingMs != null ? `${data.db.pingMs} ms` : "Nedostupna"}
          bad={data.db?.pingMs == null}
        />
        {data.db?.saturation != null && (
          <Row
            label="Zasićenost pool-a"
            value={`${Math.round(data.db.saturation * 100)}%`}
            bad={data.db.saturation > 0.8}
          />
        )}
      </Card>
    </Screen>
  );
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-neutral-400 text-xs flex-1 pr-2">{label}</Text>
      <Text className={bad ? "text-red-500 text-xs font-bold" : "text-neutral-900 text-xs font-semibold"}>
        {value}
      </Text>
    </View>
  );
}
