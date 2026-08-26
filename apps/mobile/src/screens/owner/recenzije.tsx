import { ActivityIndicator, Text, View } from "react-native";
import { DIRECTION_LABELS } from "@ekonobar/shared/formatting/labels";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import type { VenueReview } from "@ekonobar/shared/api/venue";
import { useModerateReview, usePrimaryVenue, useVenueReviews } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, PrimaryButton, SecondaryButton, TonePill } from "@/ui/primitives";

export default function OwnerRecenzijeScreen() {
  const { venue } = usePrimaryVenue();
  const { data, isLoading, error } = useVenueReviews(venue?.id);

  return (
    <Screen title="Recenzije" subtitle={venue?.name}>
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Recenzije trenutno nisu dostupne." />}
      {data?.length === 0 && <Empty text="Još nema recenzija." />}
      {data?.map(r => <ReviewRow key={r.id} review={r} />)}
    </Screen>
  );
}

function ReviewRow({ review }: { review: VenueReview }) {
  const moderate = useModerateReview();
  // Only PENDING reviews can be approved or rejected — the rest are already
  // published, removed or disputed, and the route would answer 400.
  const actionable = review.status === "PENDING";

  const statusTone = review.status === "PUBLISHED" ? "green"
    : review.status === "DISPUTED" ? "red"
    : "amber";
  const statusLabel = review.status === "PUBLISHED" ? "Objavljeno"
    : review.status === "DISPUTED" ? "Sporno"
    : "Čeka objavu";

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 font-bold text-xs flex-1 pr-2">
          {review.author?.name ?? review.guestHandle ?? "Gost"}
        </Text>
        <TonePill tone="orange">{"★ "}{(review.overallRating / 20).toFixed(1)}</TonePill>
      </View>

      <View className="flex-row flex-wrap gap-1.5 mt-2">
        <TonePill tone="neutral">{DIRECTION_LABELS[review.direction] ?? review.direction}</TonePill>
        <TonePill tone={statusTone}>{statusLabel}</TonePill>
        <TonePill tone="neutral">{timeAgo(review.publishedAt ?? review.createdAt)}</TonePill>
      </View>

      {review.comment && (
        <Text className="text-neutral-600 text-xs mt-2 italic">{review.comment}</Text>
      )}

      {actionable && (
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1">
            <PrimaryButton
              label="Objavi"
              disabled={moderate.isPending}
              onPress={() => moderate.mutate({ id: review.id, action: "approve" })}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label="Odbaci"
              disabled={moderate.isPending}
              onPress={() => moderate.mutate({ id: review.id, action: "reject" })}
            />
          </View>
        </View>
      )}
    </Card>
  );
}
