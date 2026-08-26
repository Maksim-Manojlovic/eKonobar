import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@ekonobar/shared/design-tokens";

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
      <View className="px-5 pb-3 pt-2">
        <Text className="text-white text-2xl font-extrabold">{title}</Text>
        {subtitle && <Text className="text-white/40 text-xs mt-0.5">{subtitle}</Text>}
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

/** Placeholder for a screen whose feature phase has not been built yet. */
export function Pending({ phase }: { phase: string }) {
  return (
    <Card>
      <Text className="text-neutral-900 font-bold">Uskoro</Text>
      <Text className="text-neutral-500 text-xs mt-1">Ekran stiže u fazi {phase}.</Text>
    </Card>
  );
}
