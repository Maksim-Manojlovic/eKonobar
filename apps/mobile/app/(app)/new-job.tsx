import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ENGAGEMENT_LABELS } from "@ekonobar/shared/formatting/labels";
import { ENGAGEMENT_TYPES, TIP_SYSTEMS } from "@ekonobar/shared/enums";
import { colors } from "@ekonobar/shared/design-tokens";
import { useCreateJobPost, usePrimaryVenue } from "@/api/venue-queries";
import { BackChevron } from "@/ui/auth-kit";
import { ChipPicker, FormError, FormField, Section, SubmitButton, SwitchRow } from "@/ui/form";
import { Empty } from "@/ui/primitives";

/**
 * New job post.
 *
 * Options come from the shared enum objects rather than a hand-written list, so
 * adding an EngagementType to the schema surfaces here without an edit — the
 * same reason the seed derives its arrays with Object.values.
 */

const ENGAGEMENT_OPTIONS = Object.values(ENGAGEMENT_TYPES).map(v => ({
  value: v,
  label: ENGAGEMENT_LABELS[v] ?? v,
}));

const TIP_OPTIONS = [
  { value: TIP_SYSTEMS.INDIVIDUAL,   label: "Konobar zadržava" },
  { value: TIP_SYSTEMS.SHARED,       label: "Zajednički fond" },
  { value: TIP_SYSTEMS.VENUE_POLICY, label: "Politika lokala" },
];

export default function NewJobScreen() {
  const router = useRouter();
  const { venue } = usePrimaryVenue();
  const create = useCreateJobPost();

  const [form, setForm] = useState({
    title: "", description: "",
    engagementType: ENGAGEMENT_TYPES.FULL_TIME as string,
    tipSystem: TIP_SYSTEMS.INDIVIDUAL as string,
    salaryMin: "", salaryMax: "",
    sanitaryRequired: false,
    redAlert: false, redAlertNote: "",
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

  // The API requires a description; an empty one is a 400 rather than a post
  // with no body, so the button stays disabled until both are filled.
  const canSubmit = form.title.trim().length > 0 && form.description.trim().length > 0;

  const submit = () => {
    const num = (s: string) => (s.trim() ? Number(s.replace(/\D/g, "")) : null);
    create.mutate(
      {
        venueId:          venue.id,
        title:            form.title.trim(),
        description:      form.description.trim(),
        engagementType:   form.engagementType,
        tipSystem:        form.tipSystem,
        salaryMin:        num(form.salaryMin),
        salaryMax:        num(form.salaryMax),
        sanitaryRequired: form.sanitaryRequired,
        redAlert:         form.redAlert,
        redAlertNote:     form.redAlert && form.redAlertNote.trim() ? form.redAlertNote.trim() : null,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.shell.bg }}>
      <View className="flex-row items-center px-4 pt-1 pb-2">
        <BackChevron onPress={() => router.back()} />
        <Text className="text-white text-[20px] font-black ml-1">Novi oglas</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 18 }}>
        <Text className="text-white/40 text-xs font-normal">{venue.name}</Text>

        <Section title="Pozicija">
          <FormField
            label="Naziv"
            value={form.title}
            onChangeText={v => setField("title", v)}
            placeholder="npr. Konobar — večernja smena"
          />
          <FormField
            label="Opis"
            value={form.description}
            onChangeText={v => setField("description", v)}
            placeholder="Šta posao podrazumeva, koga tražite…"
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: colors.shell.border,
              paddingVertical: 12, fontSize: 14.5, minHeight: 96, textAlignVertical: "top",
            }}
          />
          <ChipPicker
            label="Tip angažmana"
            options={ENGAGEMENT_OPTIONS}
            value={form.engagementType}
            onChange={v => setField("engagementType", v)}
          />
        </Section>

        <Section title="Uslovi">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField
                label="Plata od (RSD)"
                value={form.salaryMin}
                onChangeText={v => setField("salaryMin", v)}
                placeholder="60000"
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="do (RSD)"
                value={form.salaryMax}
                onChangeText={v => setField("salaryMax", v)}
                placeholder="90000"
                keyboardType="number-pad"
              />
            </View>
          </View>
          <ChipPicker
            label="Bakšiš"
            options={TIP_OPTIONS}
            value={form.tipSystem}
            onChange={v => setField("tipSystem", v)}
          />
          <SwitchRow
            label="Sanitarna knjižica obavezna"
            value={form.sanitaryRequired}
            onChange={v => setField("sanitaryRequired", v)}
          />
        </Section>

        <Section title="Hitno">
          <SwitchRow
            label="Red Alert"
            hint="Odmah obaveštava dostupne konobare u tvojoj opštini."
            value={form.redAlert}
            onChange={v => setField("redAlert", v)}
          />
          {form.redAlert && (
            <FormField
              label="Napomena (opciono)"
              value={form.redAlertNote}
              onChangeText={v => setField("redAlertNote", v)}
              placeholder="npr. Treba nam neko za večeras u 20h"
            />
          )}
        </Section>

        <FormError error={create.error} />

        <SubmitButton
          label="Objavi oglas"
          disabled={!canSubmit}
          busy={create.isPending}
          onPress={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
