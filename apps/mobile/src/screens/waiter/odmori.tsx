import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { LeaveBalanceEntry, WaiterLeaveRequest } from "@ekonobar/shared/api/waiter";
import { colors } from "@ekonobar/shared/design-tokens";
import {
  useCreateLeaveRequest,
  useLeaveBalance,
  useMyLeaveRequests,
  useResolveLeave,
} from "@/api/leave-queries";
import { Card, Screen } from "@/ui/Screen";
import { Empty, SecondaryButton } from "@/ui/primitives";
import { ChipPicker, DateField, FormError, FormField, SubmitButton } from "@/ui/form";
import { LeaveStat, LeaveStatusBadge, formatRange, leaveTypeLabel } from "@/ui/leave-kit";

/**
 * Odmori — the worker's side.
 *
 * A worker only has a balance where they are on a venue's roster (VenueStaff),
 * which is not the same as having worked a shift there. So an empty state here
 * means "no venue has you on staff", not "something failed" — and it says that,
 * because otherwise the screen looks broken to someone who only picks up open
 * shifts.
 */

const TYPE_OPTIONS = [
  { value: "ANNUAL",   label: "Godišnji" },
  { value: "SICK",     label: "Bolovanje" },
  { value: "UNPAID",   label: "Neplaćeno" },
  { value: "PARENTAL", label: "Roditeljsko" },
  { value: "SPECIAL",  label: "Plaćeno" },
];

export default function WaiterOdmoriScreen() {
  const balance  = useLeaveBalance();
  const requests = useMyLeaveRequests();
  const create   = useCreateLeaveRequest();
  const resolve  = useResolveLeave();

  const [formOpen, setFormOpen] = useState(false);

  const balances = balance.data?.balances ?? [];
  const rows     = requests.data?.requests ?? [];

  if (balance.isLoading) return <Screen title="Odmori"><Empty text="Učitavanje…" /></Screen>;

  if (balances.length === 0) {
    return (
      <Screen title="Odmori">
        <Empty text="Nisi na spisku osoblja nijednog lokala. Odmor se traži tek kad te lokal doda u ekipu." />
      </Screen>
    );
  }

  const cancel = (r: WaiterLeaveRequest) =>
    Alert.alert("Otkazati zahtev?", formatRange(r.startDate, r.endDate), [
      { text: "Ne", style: "cancel" },
      {
        text: "Otkaži zahtev",
        style: "destructive",
        onPress: () => resolve.mutate({ id: r.id, action: "cancel" }),
      },
    ]);

  return (
    <Screen title="Odmori" subtitle={`${balance.data?.year ?? ""}`}>
      {balances.map(b => <BalanceCard key={b.staffId} balance={b} />)}

      {formOpen ? (
        <RequestForm
          balances={balances}
          busy={create.isPending}
          error={create.error}
          onCancel={() => setFormOpen(false)}
          onSubmit={body =>
            create.mutate(body, { onSuccess: () => setFormOpen(false) })
          }
        />
      ) : (
        <SecondaryButton label="Novi zahtev" onPress={() => setFormOpen(true)} />
      )}

      <Text className="text-white/85 font-extrabold text-[13px] mt-2">Zahtevi</Text>
      {rows.length === 0
        ? <Empty text="Još nema zahteva." />
        : rows.map(r => <RequestRow key={r.id} request={r} onCancel={() => cancel(r)} />)}
    </Screen>
  );
}

function BalanceCard({ balance: b }: { balance: LeaveBalanceEntry }) {
  return (
    <Card>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-neutral-900 font-bold text-sm">{b.venue.name}</Text>
        <Text className="text-neutral-400 text-[11px] font-normal">{b.position}</Text>
      </View>

      <View className="flex-row justify-around">
        <LeaveStat label="Preostalo" value={b.remainingDays} />
        <LeaveStat label="Iskorišćeno" value={b.usedDays} tone="muted" />
        <LeaveStat label="Na čekanju" value={b.pendingDays} tone="muted" />
        <LeaveStat label="Bolovanje" value={b.sickDaysTaken} tone="muted" />
      </View>

      <Text className="text-neutral-300 text-[10.5px] mt-3 font-normal text-center">
        {b.entitledDays} dana godišnje
        {b.carriedInDays > 0 && ` · ${b.carriedInDays} prenetih`}
        {" · najava "}{b.policy.minNoticeDays}{" dana unapred"}
      </Text>
    </Card>
  );
}

function RequestRow({ request: r, onCancel }: {
  request: WaiterLeaveRequest;
  onCancel: () => void;
}) {
  const cancellable = r.status === "PENDING" || r.status === "APPROVED";

  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-neutral-900 font-bold text-[13px]">
            {leaveTypeLabel(r.type)}
          </Text>
          <Text className="text-neutral-400 text-[11.5px] font-normal mt-0.5">
            {formatRange(r.startDate, r.endDate)} · {r.days} {r.days === 1 ? "dan" : "dana"}
          </Text>
          <Text className="text-neutral-300 text-[10.5px] font-normal mt-0.5">
            {r.venue.name}
          </Text>
        </View>
        <LeaveStatusBadge status={r.status} />
      </View>

      {r.reason && (
        <Text className="text-neutral-500 text-[11.5px] font-normal mt-2">{r.reason}</Text>
      )}

      {r.status === "REJECTED" && r.rejectReason && (
        <View className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
          <Text className="text-red-700 text-[11px] font-normal">{r.rejectReason}</Text>
        </View>
      )}

      {r.autoApproved && (
        <Text className="text-green-700 text-[10.5px] font-semibold mt-2">
          Automatski odobreno po pravilniku lokala
        </Text>
      )}

      {cancellable && (
        <Pressable onPress={onCancel} className="mt-2 self-start">
          <Text className="text-red-500 text-[11px] font-bold">Otkaži zahtev</Text>
        </Pressable>
      )}
    </Card>
  );
}

function RequestForm({ balances, busy, error, onSubmit, onCancel }: {
  balances: LeaveBalanceEntry[];
  busy:     boolean;
  error:    unknown;
  onSubmit: (body: { venueId: string; type: string; startDate: string; endDate: string; reason: string | null }) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    venueId:   balances[0]?.venue.id ?? "",
    type:      "ANNUAL",
    startDate: today,
    endDate:   today,
    reason:    "",
  });
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  // The server rejects an end before the start with a 400; catching it here
  // saves a round trip and says so in the same place the user is typing.
  const orderOk  = form.endDate >= form.startDate;
  const canSubmit = dateOk(form.startDate) && dateOk(form.endDate) && orderOk && !!form.venueId;

  return (
    <View className="gap-3">
      {balances.length > 1 && (
        <ChipPicker
          label="Lokal"
          options={balances.map(b => ({ value: b.venue.id, label: b.venue.name }))}
          value={form.venueId}
          onChange={v => setField("venueId", v)}
        />
      )}

      <ChipPicker
        label="Tip"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={v => setField("type", v)}
      />

      <DateField label="Od" value={form.startDate} onChange={v => setField("startDate", v)} />
      <DateField label="Do" value={form.endDate}   onChange={v => setField("endDate", v)} />

      {!orderOk && (
        <Text className="text-red-400 text-[11px] font-normal">
          Krajnji datum je pre početnog.
        </Text>
      )}

      <FormField
        label="Razlog (opciono)"
        value={form.reason}
        onChangeText={v => setField("reason", v)}
        placeholder="npr. Putovanje"
        multiline
        numberOfLines={2}
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1, borderColor: colors.shell.border,
          paddingVertical: 12, fontSize: 14.5, minHeight: 60, textAlignVertical: "top",
        }}
      />

      <FormError error={error} />

      <SubmitButton
        label="Pošalji zahtev"
        disabled={!canSubmit}
        busy={busy}
        onPress={() => onSubmit({
          venueId:   form.venueId,
          type:      form.type,
          startDate: form.startDate.trim(),
          endDate:   form.endDate.trim(),
          reason:    form.reason.trim() || null,
        })}
      />
      <Pressable onPress={onCancel} className="items-center py-1">
        <Text className="text-white/40 text-xs font-semibold">Otkaži</Text>
      </Pressable>
    </View>
  );
}
