import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "@ekonobar/shared/design-tokens";
import { useCreateShift, usePrimaryVenue } from "@/api/venue-queries";
import { BackChevron } from "@/ui/auth-kit";
import { DateField, FormError, FormField, Section, SubmitButton, SwitchRow } from "@/ui/form";
import { Empty } from "@/ui/primitives";

/**
 * New shift.
 *
 * An overnight shift is entered exactly as it reads — 22:00 to 04:00 — and the
 * server rolls the end date forward: computeScheduledEnd detects endTime <
 * startTime. Nothing here needs to ask "next day?".
 */
export default function NewShiftScreen() {
  const router = useRouter();
  const { venue } = usePrimaryVenue();
  const create = useCreateShift();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "", date: today,
    startTime: "18:00", endTime: "24:00",
    requiredCount: "2", pay: "", tipEstimate: "",
    role: "", briefingNote: "", swapLocked: false,
  });
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  if (!venue) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
        <Empty text="Nemaš registrovan lokal." />
      </SafeAreaView>
    );
  }

  const timeOk = (t: string) => /^([01]?\d|2[0-4]):[0-5]\d$/.test(t.trim());
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(form.date.trim());
  const canSubmit =
    form.title.trim().length > 0 && dateOk && timeOk(form.startTime) && timeOk(form.endTime);

  const submit = () => {
    const num = (s: string) => (s.trim() ? Number(s.replace(/\D/g, "")) : null);
    create.mutate(
      {
        venueId:       venue.id,
        title:         form.title.trim(),
        date:          form.date.trim(),
        startTime:     form.startTime.trim(),
        endTime:       form.endTime.trim(),
        role:          form.role.trim() || null,
        pay:           num(form.pay),
        tipEstimate:   num(form.tipEstimate),
        requiredCount: Math.max(1, Number(form.requiredCount.replace(/\D/g, "")) || 1),
        briefingNote:  form.briefingNote.trim() || null,
        swapLocked:    form.swapLocked,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
      <View className="flex-row items-center px-4 pt-1 pb-2">
        <BackChevron onPress={() => router.back()} />
        <Text className="text-white text-[20px] font-black ml-1">Nova smena</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 18 }}>
        <Text className="text-white/40 text-xs font-normal">{venue.name}</Text>

        <Section title="Kada">
          <FormField
            label="Naziv smene"
            value={form.title}
            onChangeText={v => setField("title", v)}
            placeholder="npr. Večernja smena"
          />
          <DateField label="Datum" value={form.date} onChange={v => setField("date", v)} />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField
                label="Od"
                value={form.startTime}
                onChangeText={v => setField("startTime", v)}
                placeholder="18:00"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Do"
                value={form.endTime}
                onChangeText={v => setField("endTime", v)}
                placeholder="24:00"
                hint="Prekonoć: npr. 04:00"
              />
            </View>
          </View>
        </Section>

        <Section title="Ekipa">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField
                label="Broj ljudi"
                value={form.requiredCount}
                onChangeText={v => setField("requiredCount", v)}
                placeholder="2"
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Pozicija"
                value={form.role}
                onChangeText={v => setField("role", v)}
                placeholder="Konobar"
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField
                label="Naknada (RSD)"
                value={form.pay}
                onChangeText={v => setField("pay", v)}
                placeholder="3500"
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Očekivani bakšiš"
                value={form.tipEstimate}
                onChangeText={v => setField("tipEstimate", v)}
                placeholder="600"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Section>

        <Section title="Detalji">
          <FormField
            label="Brifing"
            value={form.briefingNote}
            onChangeText={v => setField("briefingNote", v)}
            placeholder="Vidljivo konobaru pre smene…"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: colors.shell.border,
              paddingVertical: 12, fontSize: 14.5, minHeight: 76, textAlignVertical: "top",
            }}
          />
          <SwitchRow
            label="Zabrani zamene"
            hint="Konobar neće moći da traži zamenu za ovu smenu."
            value={form.swapLocked}
            onChange={v => setField("swapLocked", v)}
          />
        </Section>

        <FormError error={create.error} />

        <SubmitButton
          label="Sačuvaj smenu"
          disabled={!canSubmit}
          busy={create.isPending}
          onPress={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
