import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@ekonobar/shared/design-tokens";
import { useNotifications } from "@/api/queries";

/**
 * The dark shell every screen sits in.
 *
 * Matches the web dashboards and the design prototype: #120a00 ground, white
 * cards on top, orange accent. Defined once here so no screen hard-codes a hex.
 */
export function Screen({ title, subtitle, children }: {
  title:     string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View className="flex-1 pr-3">
          <Text className="text-white text-[23px] font-black" numberOfLines={1}>{title}</Text>
          {subtitle && <Text className="text-white/40 text-xs mt-0.5 font-normal">{subtitle}</Text>}
        </View>
        <NotificationBell />
      </View>
      {/* contentContainerStyle rather than contentContainerClassName: NativeWind
          types className on the component itself, not on the content container,
          so the class variant does not typecheck against ScrollViewProps. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** White card on the dark ground — the `dash-card` equivalent. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4" style={{ borderWidth: 1, borderColor: "#f0efec" }}>
      {children}
    </View>
  );
}

/**
 * Bell + unread dot, in every screen header — the prototype puts it there on
 * every surface, and it is the only entry point to the notification feed.
 */
function NotificationBell() {
  const router = useRouter();
  const { data } = useNotifications();
  const unread = data?.unreadCount ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      className="items-center justify-center rounded-xl"
      style={{
        width: 36, height: 36,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: colors.shell.border,
      }}
      hitSlop={6}
    >
      <Bell size={16} color="rgba(255,255,255,0.75)" />
      {unread > 0 && (
        <View
          style={{
            position: "absolute", top: 6, right: 7,
            width: 7, height: 7, borderRadius: 4,
            backgroundColor: colors.primary[500],
            borderWidth: 1.5, borderColor: colors.shell.bg,
          }}
        />
      )}
    </Pressable>
  );
}

/** Placeholder for a screen whose feature phase has not been built yet. */
export function Pending({ phase }: { phase: string }) {
  return (
    <Card>
      <Text className="text-neutral-900 font-bold">Uskoro</Text>
      <Text className="text-neutral-500 text-xs mt-1 font-normal">Ekran stiže u fazi {phase}.</Text>
    </Card>
  );
}
