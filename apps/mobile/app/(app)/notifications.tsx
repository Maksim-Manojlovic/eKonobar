import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import { useMarkNotificationsRead, useNotificationHistory, type NotificationRow } from "@/api/queries";
import { mapNotificationLink } from "@/push/links";
import { Card, Screen } from "@/ui/Screen";
import { Empty, SecondaryButton, TonePill } from "@/ui/primitives";

const TYPE_ICON: Record<string, string> = {
  APPLICATION_RECEIVED: "📝", APPLICATION_STATUS_CHANGED: "📝",
  SWAP_REQUESTED: "🔁",       SWAP_RESOLVED: "🔁",
  SHIFT_CLAIMED: "📅",        SHIFT_ASSIGNED: "📅",
  REVIEW_RECEIVED: "⭐",       REVIEW_PUBLISHED: "⭐",
  CLOCKIN_APPROVAL_REQUESTED: "⏰", CLOCKIN_RESOLVED: "⏰",
  RED_ALERT_POSTED: "⚡",
  LEAVE_REQUESTED: "🌴", LEAVE_RESOLVED: "🌴", LEAVE_CANCELLED: "🌴",
};

export default function NotificationsScreen() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationHistory();
  const rows = data?.pages.flatMap(p => p.notifications) ?? [];
  const markRead = useMarkNotificationsRead();

  // Opening the feed is the read receipt, same as the web bell. The count comes
  // off the first page — every page carries it, and only the first is guaranteed
  // to have been fetched.
  const unread = data?.pages[0]?.unreadCount ?? 0;
  useEffect(() => {
    if (unread > 0) markRead.mutate(undefined);
    // Deliberately keyed on the count only: re-running on every mutate would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread > 0]);

  return (
    <Screen title="Obaveštenja">
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Obaveštenja trenutno nisu dostupna." />}
      {rows.length === 0 && <Empty text="Nema obaveštenja." />}
      {rows.map(n => <Row key={n.id} n={n} />)}
      {hasNextPage && (
        <SecondaryButton
          label={isFetchingNextPage ? "Učitavam…" : "Prikaži starija"}
          disabled={isFetchingNextPage}
          onPress={() => fetchNextPage()}
        />
      )}
    </Screen>
  );
}

function Row({ n }: { n: NotificationRow }) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push(mapNotificationLink(n.link))}>
      <Card>
        <View className="flex-row gap-3">
          <Text className="text-lg font-normal">{TYPE_ICON[n.type] ?? "🔔"}</Text>
          <View className="flex-1">
            <Text className="text-neutral-900 font-bold text-[13.5px]">{n.title}</Text>
            <Text className="text-neutral-600 text-xs mt-0.5 font-normal">{n.body}</Text>
            <Text className="text-neutral-400 text-[10.5px] mt-1.5 font-normal">{timeAgo(n.createdAt)}</Text>
          </View>
          {!n.read && <TonePill tone="orange">Novo</TonePill>}
        </View>
      </Card>
    </Pressable>
  );
}
