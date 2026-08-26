import { ActivityIndicator, Text, View } from "react-native";
import { DIRECTION_LABELS } from "@ekonobar/shared/formatting/labels";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import { useReviews } from "@/api/queries";
import { useAuth } from "@/auth/AuthProvider";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, TonePill, VerifiedBadge } from "@/ui/primitives";

export default function RecenzijeScreen() {
  const { user } = useAuth();
  const { data, isLoading, error } = useReviews(user?.id);

  return (
    <Screen title="Recenzije">
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Recenzije trenutno nisu dostupne." />}
      {data?.length === 0 && <Empty text="Još nemaš recenzija." />}

      {data?.map(r => (
        <Card key={r.id}>
          <View className="flex-row items-center gap-3">
            {/* author is null for guest reviews — the API models that deliberately. */}
            <Avatar name={r.author?.name ?? "Gost"} size={32} />
            <View className="flex-1">
              <Text className="text-neutral-900 font-bold text-xs">
                {r.author?.name ?? "Gost"}
              </Text>
              <Text className="text-neutral-400 text-[10px]">
                {r.publishedAt ? timeAgo(r.publishedAt) : "Čeka objavu"}
              </Text>
            </View>
            <TonePill tone="orange">★ {(r.overallRating / 20).toFixed(1)}</TonePill>
          </View>

          <View className="flex-row gap-1.5 mt-2">
            <TonePill tone="neutral">{DIRECTION_LABELS[r.direction] ?? r.direction}</TonePill>
            {r.author && <VerifiedBadge tier={r.author.verificationTier} />}
          </View>

          {r.comment && (
            <Text className="text-neutral-600 text-xs mt-2 italic">&ldquo;{r.comment}&rdquo;</Text>
          )}
        </Card>
      ))}
    </Screen>
  );
}
