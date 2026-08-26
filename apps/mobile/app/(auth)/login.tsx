import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@ekonobar/shared/design-tokens";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError } from "@/api/client";

export default function LoginScreen() {
  const { signIn } = useAuth();
  // One object rather than a useState per field — the grouped-form-state rule
  // the web side follows (CQ-N/CQ-P/CQ-Q). Loading and error stay separate,
  // because they are control state, not form data.
  const [form, setForm]       = useState({ email: "", password: "" });
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const setField = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email.trim(), form.password);
    } catch (err) {
      // The server's message is already user-facing Serbian (wrong credentials,
      // rate limited), so show it rather than inventing a generic one.
      setError(err instanceof ApiError ? err.message : "Greška u vezi. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = form.email.length > 0 && form.password.length > 0 && !busy;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
      <View className="flex-1 justify-center px-6 gap-4">
        <Text className="text-white text-3xl font-bold">eKonobar</Text>
        <Text className="text-white/50 mb-4 font-normal">Prijavi se na svoj nalog</Text>

        <TextInput
          value={form.email}
          onChangeText={v => setField("email", v)}
          placeholder="Email adresa"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          className="rounded-2xl px-4 py-4 text-white"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.shell.border }}
        />

        <TextInput
          value={form.password}
          onChangeText={v => setField("password", v)}
          placeholder="Lozinka"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
          autoComplete="current-password"
          className="rounded-2xl px-4 py-4 text-white"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.shell.border }}
        />

        {error && <Text style={{ color: "#fca5a5" }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          className="rounded-2xl py-4 items-center mt-2"
          style={{ backgroundColor: canSubmit ? colors.primary[500] : colors.primary[300] }}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">Prijavi se</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
