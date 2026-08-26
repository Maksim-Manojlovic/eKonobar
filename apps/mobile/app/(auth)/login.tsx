import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { AUTH_BG, BackChevron, BigButton, Field } from "@/ui/auth-kit";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  // One object for the form, separate state for loading/error — the grouped
  // form-state rule the web side follows.
  const [form, setForm]   = useState({ email: "", password: "" });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email.trim(), form.password);
    } catch (err) {
      // The server's message is already user-facing Serbian.
      setError(err instanceof ApiError ? err.message : "Greška u vezi. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = form.email.length > 0 && form.password.length > 0 && !busy;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: AUTH_BG }}>
      <View className="flex-1 px-5 pb-5">
        <BackChevron onPress={() => router.back()} />

        <Text className="text-neutral-900 font-black text-[30px] mt-2">Dobrodošao nazad</Text>
        <Text className="text-neutral-400 text-[13px] mt-1 font-normal">
          Prijavi se na svoj eKonobar nalog
        </Text>

        <View className="gap-4 mt-7">
          <Field
            label="Email adresa"
            placeholder="ime@primer.rs"
            value={form.email}
            onChangeText={v => setField("email", v)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Lozinka"
            placeholder="••••••••"
            value={form.password}
            onChangeText={v => setField("password", v)}
            secureTextEntry
            autoComplete="current-password"
          />

          <Pressable className="self-end">
            <Text className="text-orange-500 font-semibold text-[12.5px]">Zaboravljena lozinka?</Text>
          </Pressable>

          {error && <Text className="text-red-500 text-[12.5px] font-normal">{error}</Text>}
        </View>

        <View className="flex-1" />

        <BigButton
          label={busy ? "" : "Prijavi se"}
          disabled={!canSubmit}
          onPress={submit}
        />
        {busy && (
          <View style={{ position: "absolute", bottom: 40, left: 0, right: 0 }} pointerEvents="none">
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
