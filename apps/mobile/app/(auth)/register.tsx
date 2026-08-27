import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BELGRADE_MUNICIPALITIES } from "@ekonobar/shared/geo/municipalities";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { AUTH_BG, BigButton, Field, RoleCard, StepHeader } from "@/ui/auth-kit";
import { colors } from "@ekonobar/shared/design-tokens";

const EXPERIENCE = ["Bez iskustva", "1 godina", "2–3 godine", "4–5 godina", "6+ godina"];

/**
 * Three-step signup, from design/screens-auth.jsx.
 *
 * Waiter only. A venue-owner account can post jobs, read applicants' passports
 * and verify staff, so it is granted by an admin once the venue is known to be
 * real — the public path for a venue is the demo form on the website. The owner
 * card is still shown, because hiding it entirely just prompts the question, but
 * it is not selectable and says why. The register API refuses VENUE_OWNER too,
 * so this is not the only thing standing in the way.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    municipality: "", phone: "", experience: "",
    terms: true,
  });

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const back = () => (step === 1 ? router.back() : setStep(step - 1));

  const step1Ok = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email);
  const step2Ok = form.password.length >= 8;
  const step3Ok = form.terms && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", {
        method: "POST",
        anonymous: true,
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: "WAITER",
        },
      });

      await signIn(form.email.trim(), form.password);

      // Profile extras are a separate concern from account creation: the register
      // route only takes name/email/password. Best effort — a failure here must
      // not strand someone who now has a working account.
      const municipalities = form.municipality ? [form.municipality] : [];
      const years = EXPERIENCE.indexOf(form.experience);
      await api("/api/passport", {
        method: "PUT",
        body: {
          ...(municipalities.length ? { workMunicipalities: municipalities } : {}),
          ...(years > 0 ? { yearsExperience: years } : {}),
        },
      }).catch(() => undefined);

      if (form.phone.trim()) {
        await api("/api/user/notification-prefs", {
          method: "PATCH",
          body: { phone: form.phone.trim() },
        }).catch(() => undefined);
      }
      // AuthGate moves to the app as soon as the session exists.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Greška u vezi. Pokušaj ponovo.");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: AUTH_BG }}>
      <View className="flex-1 px-5 pb-5">
        <StepHeader step={step} total={3} onBack={back} />

        <ScrollView className="flex-1 mt-5" contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
          {step === 1 && (
            <>
              <Text className="text-neutral-900 font-extrabold text-xl">Ko si ti?</Text>
              <View className="flex-row gap-2.5">
                <RoleCard
                  selected
                  title="Konobar"
                  subtitle="Tražim angažmane"
                  icon={
                    <Svg width={17} height={17} viewBox="0 0 24 24">
                      <Circle cx={12} cy={8} r={4} stroke={colors.primary[500]} strokeWidth={2} fill="none" />
                      <Path d="M4 20C4 17.24 7.58 15 12 15C16.42 15 20 17.24 20 20"
                        stroke={colors.primary[500]} strokeWidth={2} strokeLinecap="round" fill="none" />
                    </Svg>
                  }
                />
                <RoleCard
                  disabled
                  title="Vlasnik lokala"
                  subtitle="Otvara tim eKonobara"
                  icon={
                    <Svg width={17} height={17} viewBox="0 0 24 24">
                      <Rect x={3} y={6} width={18} height={14} rx={3} stroke={colors.primary[500]} strokeWidth={2} fill="none" />
                      <Path d="M3 10H21M9 6V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V6"
                        stroke={colors.primary[500]} strokeWidth={2} strokeLinecap="round" fill="none" />
                    </Svg>
                  }
                />
              </View>
              <Text className="text-neutral-400 text-[11.5px] font-normal -mt-2">
                Nalog za lokal otvara naš tim nakon provere lokala — javi se preko sajta.
              </Text>

              <Field
                label="Ime i prezime"
                placeholder="Marko Milošević"
                value={form.name}
                onChangeText={v => setField("name", v)}
              />
              <Field
                label="Email adresa"
                placeholder="ime@primer.rs"
                value={form.email}
                onChangeText={v => setField("email", v)}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text className="text-neutral-900 font-extrabold text-xl">Tvoji podaci</Text>
              <Field
                label="Lozinka"
                placeholder="Min. 8 karaktera"
                value={form.password}
                onChangeText={v => setField("password", v)}
                secureTextEntry
              />

              <View>
                <Text className="text-neutral-600 font-semibold text-[12.5px] mb-1.5">Grad / Opština</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {BELGRADE_MUNICIPALITIES.map(m => {
                    const on = form.municipality === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setField("municipality", on ? "" : m)}
                        className="rounded-full px-3 py-2"
                        style={{
                          backgroundColor: on ? colors.primary[500] : "#fff",
                          borderWidth: 1.5, borderColor: on ? colors.primary[500] : "#e5e5e3",
                        }}
                      >
                        <Text
                          className="text-[11.5px] font-semibold"
                          style={{ color: on ? "#fff" : "#57534e" }}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Field
                label="Broj telefona (opciono)"
                placeholder="+381 60 000 0000"
                value={form.phone}
                onChangeText={v => setField("phone", v)}
                keyboardType="phone-pad"
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text className="text-neutral-900 font-extrabold text-xl">Skoro gotovo</Text>

              <View>
                <Text className="text-neutral-600 font-semibold text-[12.5px] mb-1.5">Godine iskustva</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {EXPERIENCE.map(e => {
                    const on = form.experience === e;
                    return (
                      <Pressable
                        key={e}
                        onPress={() => setField("experience", on ? "" : e)}
                        className="rounded-full px-3 py-2"
                        style={{
                          backgroundColor: on ? colors.primary[500] : "#fff",
                          borderWidth: 1.5, borderColor: on ? colors.primary[500] : "#e5e5e3",
                        }}
                      >
                        <Text className="text-[11.5px] font-semibold" style={{ color: on ? "#fff" : "#57534e" }}>
                          {e}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View
                className="rounded-2xl p-3.5 gap-2"
                style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}
              >
                <Text className="text-orange-700 font-bold text-[12px]">Šta dobijaš odmah:</Text>
                {[
                  "Waiter Passport™ profil — besplatno",
                  "Pristup Red Alert™ oglasima",
                  "Geofencing verifikacija smena",
                ].map(t => (
                  <View key={t} className="flex-row items-center gap-2">
                    <Text className="text-orange-500 font-bold text-[12px]">✓</Text>
                    <Text className="text-neutral-600 text-[12px] font-normal flex-1">{t}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setField("terms", !form.terms)}
                className="flex-row items-start gap-2.5"
              >
                <View
                  className="items-center justify-center rounded"
                  style={{
                    width: 18, height: 18, marginTop: 1,
                    backgroundColor: form.terms ? colors.primary[500] : "#fff",
                    borderWidth: 1.5, borderColor: form.terms ? colors.primary[500] : "#d4d4d4",
                  }}
                >
                  {form.terms && <Text className="text-white text-[11px] font-bold">✓</Text>}
                </View>
                <Text className="text-neutral-500 text-[11.5px] flex-1 font-normal">
                  Slažem se sa Uslovima korišćenja i Politikom privatnosti.
                </Text>
              </Pressable>
            </>
          )}

          {error && <Text className="text-red-500 text-[12.5px] font-normal">{error}</Text>}
        </ScrollView>

        {step < 3 ? (
          <BigButton
            label="Nastavi →"
            disabled={step === 1 ? !step1Ok : !step2Ok}
            onPress={() => setStep(step + 1)}
          />
        ) : (
          <BigButton
            label={busy ? "Kreiranje naloga…" : "Kreiraj nalog →"}
            disabled={!step3Ok}
            onPress={submit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
