import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import { useMarkNotificationsRead, useNotifications, type NotificationRow } from "@/api/queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, TonePill } from "@/ui/primitives";

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
  const { data, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Opening the feed is the read receipt, same as the web bell.
  const unread = data?.unreadCount ?? 0;
  useEffect(() => {
    if (unread > 0) markRead.mutate(undefined);
    // Deliberately keyed on the count only: re-running on every mutate would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread > 0]);

  return (
    <Screen title="Obaveštenja">
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Obaveštenja trenutno nisu dostupna." />}
      {data?.notifications.length === 0 && <Empty text="Nema obaveštenja." />}
      {data?.notifications.map(n => <Row key={n.id} n={n} />)}
    </Screen>
  );
}

function Row({ n }: { n: NotificationRow }) {
  const router = useRouter();

  return (
    <Pressable onPress={() => { if (n.link) router.push(mapLink(n.link)); }}>
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

/**
 * Server links are web dashboard paths ("/dashboard/venue", "/waiter/smene").
 * The tab names happen to line up, so a suffix match is enough — and anything
 * unrecognised goes home rather than to a route that does not exist.
 */
function mapLink(link: string): "/" | "/poslovi" | "/smene" | "/recenzije" | "/passport" {
  if (link.includes("smene") || link.includes("shift")) return "/smene";
  if (link.includes("poslov") || link.includes("job") || link.includes("application")) return "/poslovi";
  if (link.includes("recenzij") || link.includes("review")) return "/recenzije";
  if (link.includes("passport") || link.includes("pasos")) return "/passport";
  return "/";
}
