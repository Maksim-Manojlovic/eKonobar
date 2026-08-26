import { ActivityIndicator, Text, View } from "react-native";
import { DIRECTION_LABELS } from "@ekonobar/shared/formatting/labels";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import type { DisputedReview } from "@ekonobar/shared/api/admin";
import { useDisputedReviews, useResolveDispute } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, PrimaryButton, SecondaryButton, TonePill } from "@/ui/primitives";

/**
 * Admin — disputed reviews.
 *
 * A review lands here when it is high-friction: a swing large enough that
 * publishing it unexamined would move someone's score hard in one step. The
 * decision is publish or remove, and it is the only thing on the screen.
 */
export default function AdminDisputesScreen() {
  const { data, isLoading, error } = useDisputedReviews();

  return (
    <Screen title="Sporne recenzije">
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Podaci trenutno nisu dostupni." />}
      {data?.length === 0 && <Empty text="Nema spornih recenzija." />}
      {data?.map(r => <DisputeRow key={r.id} review={r} />)}
    </Screen>
  );
}

function DisputeRow({ review }: { review: DisputedReview }) {
  const resolve = useResolveDispute();

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 font-bold text-xs flex-1 pr-2">
          {/* author is null for guest reviews — Review.authorId is nullable. */}
          {review.author?.name ?? "Gost"}
          {review.subject?.name ? ` → ${review.subject.name}` : ""}
        </Text>
        <TonePill tone="orange">{"★ "}{(review.overallRating / 20).toFixed(1)}</TonePill>
      </View>

      <View className="flex-row flex-wrap gap-1.5 mt-2">
        <TonePill tone="neutral">{DIRECTION_LABELS[review.direction] ?? review.direction}</TonePill>
        {review.venue && <TonePill tone="neutral">{review.venue.name}</TonePill>}
        <TonePill tone="neutral">{timeAgo(review.createdAt)}</TonePill>
      </View>

      {review.comment && (
        <Text className="text-neutral-600 text-xs mt-2 italic font-normal">{review.comment}</Text>
      )}

      <View className="flex-row gap-2 mt-3">
        <View className="flex-1">
          <PrimaryButton
            label="Objavi"
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ id: review.id, action: "publish" })}
          />
        </View>
        <View className="flex-1">
          <SecondaryButton
            label="Ukloni"
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ id: review.id, action: "remove" })}
          />
        </View>
      </View>
    </Card>
  );
}
