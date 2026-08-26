import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AUTH_BG, BigButton, LogoMark } from "@/ui/auth-kit";

/** Welcome — the first screen a signed-out user sees. */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: "#fffdf9" }}>
      <View className="flex-1 px-6 pb-6">
        <View className="flex-1 items-center justify-center gap-4">
          <LogoMark size={64} />
          <Text className="text-neutral-900 font-black text-[28px]">eKonobar</Text>
          <Text
            className="text-neutral-500 text-[15px] text-center font-normal"
            style={{ maxWidth: 280, lineHeight: 22 }}
          >
            Pronađi smenu ili popuni je za 15 minuta — bez agencija, bez papira.
          </Text>
        </View>

        <View className="gap-2.5">
          <BigButton label="Napravi nalog" onPress={() => router.push("/register")} />
          <BigButton label="Prijavi se" variant="secondary" onPress={() => router.push("/login")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
