import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { ShiftTemplate } from "@ekonobar/shared/api/venue";
import { colors } from "@ekonobar/shared/design-tokens";
import { usePrimaryVenue } from "@/api/venue-queries";
import {
  useCreateTemplate, useDeleteTemplate, useGenerateShifts, useTemplates,
  type GenerateResult,
} from "@/api/template-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, PrimaryButton, TonePill } from "@/ui/primitives";
import { ChipPicker, DateField, FormError, FormField, SubmitButton, SwitchRow } from "@/ui/form";

/**
 * Šabloni — recurring shifts.
 *
 * A template describes one repeating slot; generation turns a date range into
 * real Shift rows from it. Generation is idempotent on templateId + date, so
 * "generate the next month" is safe to press twice — the second run reports
 * everything as skipped rather than duplicating a month of shifts.
 *
 * The server also reports which generated dates already have roster members on
 * approved leave. That is coverage information, not a conflict: generated
 * shifts start unassigned, so nobody is double-booked. It tells the owner which
 * dates will be hard to fill.
 */

const DAYS = [
  { value: 1, label: "Pon" }, { value: 2, label: "Uto" }, { value: 3, label: "Sre" },
  { value: 4, label: "Čet" }, { value: 5, label: "Pet" }, { value: 6, label: "Sub" },
  { value: 0, label: "Ned" },
];

const DAY_LABEL: Record<number, string> = {
  0: "Nedeljom", 1: "Ponedeljkom", 2: "Utorkom", 3: "Sredom",
  4: "Četvrtkom", 5: "Petkom", 6: "Subotom",
};

export default function OwnerSabloniScreen() {
  const { venue } = usePrimaryVenue();
  const { data, isLoading } = useTemplates();
  const create   = useCreateTemplate();
  const remove   = useDeleteTemplate();
  const generate = useGenerateShifts();

  const [adding, setAdding] = useState(false);

  if (!venue)    return <Screen title="Šabloni"><Empty text="Nemaš registrovan lokal." /></Screen>;
  if (isLoading) return <Screen title="Šabloni"><Empty text="Učitavanje…" /></Screen>;

  const templates = data ?? [];

  const confirmDelete = (t: ShiftTemplate) =>
    Alert.alert(
      "Obrisati šablon?",
      "Već generisane smene ostaju — briše se samo obrazac po kom se prave nove.",
      [
        { text: "Otkaži", style: "cancel" },
        { text: "Obriši", style: "destructive", onPress: () => remove.mutate(t.id) },
      ],
    );

  const report = (r: GenerateResult) => {
    const lines = [
      r.created === 0
        ? "Nijedna nova smena — sve već postoje."
        : `Napravljeno ${r.created} ${r.created === 1 ? "smena" : "smena"}.`,
      r.skipped > 0 ? `Preskočeno ${r.skipped} (već postoje).` : null,
      r.leaveNotices?.length
        ? `Pažnja: ${r.leaveNotices.length} ${r.leaveNotices.length === 1 ? "datum ima" : "datuma imaju"} radnike na odmoru.`
        : null,
    ].filter(Boolean);
    Alert.alert("Gotovo", lines.join("\n"));
  };

  return (
    <Screen title="Šabloni" subtitle={venue.name}>
      {adding ? (
        <TemplateForm
          venueId={venue.id}
          busy={create.isPending}
          error={create.error}
          onCancel={() => setAdding(false)}
          onSubmit={body => create.mutate(body, { onSuccess: () => setAdding(false) })}
        />
      ) : (
        <PrimaryButton label="+ Novi šablon" onPress={() => setAdding(true)} />
      )}

      {templates.length === 0 ? (
        <Empty text="Nema šablona. Napravi jedan da bi generisao smene za ceo mesec odjednom." />
      ) : (
        templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            busy={generate.isPending}
            onDelete={() => confirmDelete(t)}
            onGenerate={(fromDate, toDate) =>
              generate.mutate({ id: t.id, fromDate, toDate }, { onSuccess: report })
            }
          />
        ))
      )}
    </Screen>
  );
}

function TemplateCard({ template: t, busy, onDelete, onGenerate }: {
  template:   ShiftTemplate;
  busy:       boolean;
  onDelete:   () => void;
  onGenerate: (fromDate: string, toDate: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const iso   = (d: Date) => d.toISOString().slice(0, 10);
  const plus  = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  const [from, setFrom] = useState(iso(today));
  const [to, setTo]     = useState(plus(30));

  const when = t.weekdaysOnly
    ? "Radnim danima"
    : t.dayOfWeek != null ? DAY_LABEL[t.dayOfWeek] : "—";

  // The server caps the range at 90 days and rejects a reversed one, so both are
  // checked here rather than sent and bounced.
  const dateOk  = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  const days    = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  const rangeOk = dateOk(from) && dateOk(to) && days >= 1 && days <= 90;

  return (
    <Card>
      <Pressable onPress={() => setOpen(v => !v)}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-neutral-900 font-bold text-[13.5px]">{t.name}</Text>
            <Text className="text-neutral-400 text-[11.5px] font-normal mt-0.5">
              {when} · {t.startTime}–{t.endTime}
            </Text>
          </View>
          <TonePill tone="orange">{t.requiredCount} {t.requiredCount === 1 ? "osoba" : "osobe"}</TonePill>
        </View>

        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {t.role && <TonePill tone="neutral">{t.role}</TonePill>}
          {t.pay != null && <TonePill tone="neutral">{t.pay.toLocaleString("sr-RS")} RSD</TonePill>}
        </View>
      </Pressable>

      {open && (
        <View className="mt-3 gap-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: "#f0f0ee" }}>
          <Text className="text-neutral-500 font-semibold text-[11.5px]">Generiši smene</Text>

          <View className="flex-row gap-1.5">
            <RangeChip label="Ovaj mesec"  onPress={() => { setFrom(iso(today)); setTo(plus(30)); }} />
            <RangeChip label="2 nedelje"   onPress={() => { setFrom(iso(today)); setTo(plus(14)); }} />
            <RangeChip label="3 meseca"    onPress={() => { setFrom(iso(today)); setTo(plus(89)); }} />
          </View>

          <Text className="text-neutral-400 text-[11px] font-normal">
            {from} → {to}
            {!rangeOk && "  · najviše 90 dana"}
          </Text>

          <Pressable
            onPress={() => onGenerate(from, to)}
            disabled={busy || !rangeOk}
            className="rounded-xl items-center py-2.5"
            style={{
              backgroundColor: busy || !rangeOk ? "#f5f5f3" : "#fff7ed",
              borderWidth: 1,
              borderColor: busy || !rangeOk ? "#e5e5e3" : "#fed7aa",
            }}
          >
            <Text
              className="font-bold text-xs"
              style={{ color: busy || !rangeOk ? "#a3a3a0" : colors.primary[700] }}
            >
              {busy ? "Generišem…" : "Generiši"}
            </Text>
          </Pressable>

          <Pressable onPress={onDelete} className="items-center py-1">
            <Text className="text-red-500 text-[11px] font-bold">Obriši šablon</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function RangeChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-1.5"
      style={{ backgroundColor: "#fafaf8", borderWidth: 1, borderColor: "#e5e5e3" }}
    >
      <Text className="text-[11px] font-bold text-neutral-600">{label}</Text>
    </Pressable>
  );
}

function TemplateForm({ venueId, busy, error, onSubmit, onCancel }: {
  venueId:  string;
  busy:     boolean;
  error:    unknown;
  onSubmit: (body: {
    venueId: string; name: string; dayOfWeek: number | null; weekdaysOnly: boolean;
    startTime: string; endTime: string; requiredCount: number; role: string | null; pay: number | null;
  }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "", dayOfWeek: 5, weekdaysOnly: false,
    startTime: "18:00", endTime: "24:00",
    requiredCount: "2", role: "", pay: "",
  });
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const timeOk = (t: string) => /^([01]?\d|2[0-4]):[0-5]\d$/.test(t.trim());
  const canSubmit =
    form.name.trim().length > 0 && timeOk(form.startTime) && timeOk(form.endTime);

  return (
    <View className="gap-3">
      <FormField
        label="Naziv"
        value={form.name}
        onChangeText={v => setField("name", v)}
        placeholder="npr. Vikend večernja"
      />

      <SwitchRow
        label="Svaki radni dan"
        hint="Pon–Pet. Isključi da bi izabrao jedan dan u nedelji."
        value={form.weekdaysOnly}
        onChange={v => setField("weekdaysOnly", v)}
      />

      {/* The server rejects a null dayOfWeek unless weekdaysOnly is set, and
          ignores it when it is — so the picker is hidden rather than disabled. */}
      {!form.weekdaysOnly && (
        <ChipPicker
          label="Dan"
          options={DAYS.map(d => ({ value: String(d.value), label: d.label }))}
          value={String(form.dayOfWeek)}
          onChange={v => setField("dayOfWeek", Number(v))}
        />
      )}

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
            hint="Prekonoć: npr. 02:00"
          />
        </View>
      </View>

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
            label="Naknada (RSD)"
            value={form.pay}
            onChangeText={v => setField("pay", v)}
            placeholder="3500"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <FormField
        label="Pozicija"
        value={form.role}
        onChangeText={v => setField("role", v)}
        placeholder="Konobar"
      />

      <FormError error={error} />

      <SubmitButton
        label="Sačuvaj šablon"
        busy={busy}
        disabled={!canSubmit}
        onPress={() => onSubmit({
          venueId,
          name:          form.name.trim(),
          weekdaysOnly:  form.weekdaysOnly,
          dayOfWeek:     form.weekdaysOnly ? null : form.dayOfWeek,
          startTime:     form.startTime.trim(),
          endTime:       form.endTime.trim(),
          requiredCount: Math.max(1, Number(form.requiredCount.replace(/\D/g, "")) || 1),
          role:          form.role.trim() || null,
          pay:           form.pay.trim() ? Number(form.pay.replace(/\D/g, "")) : null,
        })}
      />
      <Pressable onPress={onCancel} className="items-center py-1">
        <Text className="text-white/40 text-xs font-semibold">Otkaži</Text>
      </Pressable>
    </View>
  );
}
