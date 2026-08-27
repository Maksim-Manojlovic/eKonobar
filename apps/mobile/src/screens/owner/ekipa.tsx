import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { StaffMember } from "@ekonobar/shared/api/venue";
import {
  DEPARTMENT_LABELS,
  ENGAGEMENT_LABELS,
  POSITION_LABELS,
  STAFF_STATUS_LABELS,
} from "@ekonobar/shared/formatting/labels";
import { BOH_POSITIONS, FOH_POSITIONS } from "@ekonobar/shared/enums";
import { usePrimaryVenue } from "@/api/venue-queries";
import { useAddStaff, useStaff, useUpdateStaff } from "@/api/staff-queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, TonePill, VerifiedBadge, type Tone } from "@/ui/primitives";
import { ChipPicker, DateField, FormError, SubmitButton } from "@/ui/form";
import { AddStaffSearch } from "@/ui/AddStaffSearch";

/**
 * Ekipa — who actually works here.
 *
 * A VenueStaff row is what makes someone employed at this venue, as distinct
 * from having claimed an open shift. Leave balances, department scoping and
 * head-of-department permissions all key off it, which is why this screen
 * unblocks Odmori: a worker has no balance until they appear here.
 *
 * Kitchen positions are only offered when the venue has a kitchen. That is a
 * capability flag (`kitchenEnabled`, defaulted from venueType), never a branch
 * on the venue type itself — the server rejects a BOH row at a venue without
 * one, so offering it would only produce a 400.
 */

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE:    "green",
  SUSPENDED: "amber",
  ENDED:     "neutral",
};

const EMPLOYMENT_OPTIONS = ["FULL_TIME", "SEASONAL", "WEEKEND", "CELEBRATION"].map(v => ({
  value: v,
  label: ENGAGEMENT_LABELS[v] ?? v,
}));

export default function OwnerEkipaScreen() {
  const { venue } = usePrimaryVenue();
  const [showEnded, setShowEnded] = useState(false);
  const { data, isLoading } = useStaff(venue?.id, showEnded);
  const add    = useAddStaff(venue?.id);
  const update = useUpdateStaff(venue?.id);

  const [adding, setAdding] = useState(false);

  if (!venue)    return <Screen title="Ekipa"><Empty text="Nemaš registrovan lokal." /></Screen>;
  if (isLoading) return <Screen title="Ekipa"><Empty text="Učitavanje…" /></Screen>;

  const staff      = data?.staff ?? [];
  const canManage  = data?.canManage ?? false;
  const hasKitchen = data?.hasKitchen ?? false;
  const positions  = hasKitchen ? [...FOH_POSITIONS, ...BOH_POSITIONS] : [...FOH_POSITIONS];

  const foh = staff.filter(s => s.department === "FOH");
  const boh = staff.filter(s => s.department === "BOH");

  const end = (s: StaffMember) =>
    Alert.alert(
      "Prekinuti angažman?",
      `${s.waiter.name ?? "Radnik"} više neće biti na spisku osoblja i gubi pravo na odmor u ovom lokalu.`,
      [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Prekini",
          style: "destructive",
          onPress: () => update.mutate({
            staffId: s.id,
            patch: { status: "ENDED", endedAt: new Date().toISOString().slice(0, 10) },
          }),
        },
      ],
    );

  return (
    <Screen title="Ekipa" subtitle={venue.name}>
      {canManage && (
        adding ? (
          <AddStaffForm
            positions={positions}
            busy={add.isPending}
            error={add.error}
            existingIds={staff.map(s => s.waiter.id)}
            onCancel={() => setAdding(false)}
            onSubmit={body => add.mutate(body, { onSuccess: () => setAdding(false) })}
          />
        ) : (
          <PrimaryButton label="+ Dodaj u ekipu" onPress={() => setAdding(true)} />
        )
      )}

      {staff.length === 0 ? (
        <Empty text="Još nema nikoga u ekipi." />
      ) : (
        <>
          <Department
            title={DEPARTMENT_LABELS.FOH ?? "Sala"}
            rows={foh}
            canManage={canManage}
            positions={positions}
            busy={update.isPending}
            onPatch={(staffId, patch) => update.mutate({ staffId, patch })}
            onEnd={end}
          />
          {hasKitchen && (
            <Department
              title={DEPARTMENT_LABELS.BOH ?? "Kuhinja"}
              rows={boh}
              canManage={canManage}
              positions={positions}
              busy={update.isPending}
              onPatch={(staffId, patch) => update.mutate({ staffId, patch })}
              onEnd={end}
            />
          )}
        </>
      )}

      <Pressable onPress={() => setShowEnded(v => !v)} className="items-center py-2">
        <Text className="text-white/40 text-xs font-semibold">
          {showEnded ? "Sakrij bivše radnike" : "Prikaži bivše radnike"}
        </Text>
      </Pressable>
    </Screen>
  );
}

function Department({ title, rows, canManage, positions, busy, onPatch, onEnd }: {
  title:      string;
  rows:       StaffMember[];
  canManage:  boolean;
  positions:  string[];
  busy:       boolean;
  onPatch:    (staffId: string, patch: { position?: string; status?: "ACTIVE" | "SUSPENDED" }) => void;
  onEnd:      (s: StaffMember) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-white/85 font-extrabold text-[13px] mt-1">
        {title} · {rows.length}
      </Text>
      {rows.map(s => (
        <StaffCard
          key={s.id}
          member={s}
          canManage={canManage}
          positions={positions}
          busy={busy}
          onPatch={patch => onPatch(s.id, patch)}
          onEnd={() => onEnd(s)}
        />
      ))}
    </View>
  );
}

function StaffCard({ member: s, canManage, positions, busy, onPatch, onEnd }: {
  member:    StaffMember;
  canManage: boolean;
  positions: string[];
  busy:      boolean;
  onPatch:   (patch: { position?: string; status?: "ACTIVE" | "SUSPENDED" }) => void;
  onEnd:     () => void;
}) {
  const [open, setOpen] = useState(false);
  const ended = s.status === "ENDED";

  return (
    <Card>
      <Pressable
        onPress={() => canManage && !ended && setOpen(v => !v)}
        className="flex-row items-center gap-2.5"
      >
        <Avatar name={s.waiter.name} uri={s.waiter.image} size={38} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-[13px]">
            {s.waiter.name ?? "Radnik"}
          </Text>
          <Text className="text-neutral-400 text-[11px] font-normal mt-0.5">
            {POSITION_LABELS[s.position] ?? s.position}
            {" · "}{ENGAGEMENT_LABELS[s.employmentType] ?? s.employmentType}
          </Text>
        </View>
        <View className="items-end gap-1">
          <TonePill tone={STATUS_TONE[s.status] ?? "neutral"}>
            {STAFF_STATUS_LABELS[s.status] ?? s.status}
          </TonePill>
          {s.waiter.waiterPassport && (
            <Text className="text-neutral-400 text-[10.5px] font-bold">
              {s.waiter.waiterPassport.score}
            </Text>
          )}
        </View>
      </Pressable>

      <View className="flex-row flex-wrap gap-1.5 mt-2">
        <VerifiedBadge tier={s.waiter.verificationTier} />
        {s.waiter.waiterPassport?.sanitaryBookValid && <TonePill tone="blue">Sanitarna ✓</TonePill>}
        <TonePill tone="neutral">
          Od {new Date(s.startedAt).toLocaleDateString("sr-Latn-RS", { month: "short", year: "numeric" })}
        </TonePill>
      </View>

      {open && (
        <View className="mt-3 gap-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: "#f0f0ee" }}>
          <LightChips
            label="Pozicija"
            options={positions.map(p => ({ value: p, label: POSITION_LABELS[p] ?? p }))}
            value={s.position}
            onChange={v => onPatch({ position: v })}
            disabled={busy}
          />

          <View className="flex-row gap-2">
            <View className="flex-1">
              <SecondaryButton
                label={s.status === "SUSPENDED" ? "Vrati na posao" : "Suspenduj"}
                disabled={busy}
                onPress={() => onPatch({ status: s.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED" })}
              />
            </View>
            <Pressable onPress={onEnd} disabled={busy} className="flex-1 items-center justify-center">
              <Text className="text-red-500 text-xs font-bold">Prekini angažman</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}

/** ChipPicker is drawn for the dark shell; inside a white Card it needs light ink. */
function LightChips({ label, options, value, onChange, disabled }: {
  label:    string;
  options:  { value: string; label: string }[];
  value:    string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <View>
      <Text className="text-neutral-500 font-semibold text-[11.5px] mb-1.5">{label}</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {options.map(o => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => !on && onChange(o.value)}
              disabled={disabled}
              className="rounded-full px-2.5 py-1.5"
              style={{
                backgroundColor: on ? "#f97316" : "#fafaf8",
                borderWidth: 1,
                borderColor: on ? "#f97316" : "#e5e5e3",
              }}
            >
              <Text className="text-[11px] font-bold" style={{ color: on ? "#fff" : "#78716c" }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AddStaffForm({ positions, busy, error, existingIds, onSubmit, onCancel }: {
  positions:   string[];
  busy:        boolean;
  error:       unknown;
  existingIds: string[];
  onSubmit: (body: { waiterId: string; position: string; employmentType: string; startedAt: string }) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<{ id: string; name: string | null } | null>(null);
  const [form, setForm] = useState({
    position:       "WAITER",
    employmentType: "FULL_TIME",
    startedAt:      new Date().toISOString().slice(0, 10),
  });
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  if (!picked) {
    return (
      <View className="gap-3">
        <AddStaffSearch excludeIds={existingIds} onPick={w => setPicked({ id: w.id, name: w.name })} />
        <Pressable onPress={onCancel} className="items-center py-1">
          <Text className="text-white/40 text-xs font-semibold">Otkaži</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-white font-bold text-sm">{picked.name ?? "Radnik"}</Text>
        <Pressable onPress={() => setPicked(null)}>
          <Text className="text-orange-400 text-xs font-bold">Promeni</Text>
        </Pressable>
      </View>

      <ChipPicker
        label="Pozicija"
        options={positions.map(p => ({ value: p, label: POSITION_LABELS[p] ?? p }))}
        value={form.position}
        onChange={v => setField("position", v)}
      />
      <ChipPicker
        label="Tip angažmana"
        options={EMPLOYMENT_OPTIONS}
        value={form.employmentType}
        onChange={v => setField("employmentType", v)}
      />
      <DateField label="Počinje" value={form.startedAt} onChange={v => setField("startedAt", v)} />

      <FormError error={error} />

      <SubmitButton
        label="Dodaj u ekipu"
        busy={busy}
        disabled={!/^\d{4}-\d{2}-\d{2}$/.test(form.startedAt.trim())}
        onPress={() => onSubmit({ waiterId: picked.id, ...form, startedAt: form.startedAt.trim() })}
      />
      <Pressable onPress={onCancel} className="items-center py-1">
        <Text className="text-white/40 text-xs font-semibold">Otkaži</Text>
      </Pressable>
    </View>
  );
}
