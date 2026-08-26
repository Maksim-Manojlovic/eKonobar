import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { OpenShift, SwapRequest, WaiterShift } from "@ekonobar/shared/api/waiter";
import { useAuth } from "@/auth/AuthProvider";
import { useClaimShift, useClockIn, useClockOut, useMyShifts, useOpenShifts, useSwapRequests } from "@/api/queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, SegmentTabs, StaffingBar, TonePill } from "@/ui/primitives";

const TABS = [
  { id: "moje",     label: "Moje smene" },
  { id: "slobodne", label: "Slobodne" },
  { id: "zahtevi",  label: "Zahtevi" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SmeneScreen() {
  const [tab, setTab] = useState<TabId>("moje");

  return (
    <Screen title="Smene">
      <View className="-mx-5">
        <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />
      </View>

      {tab === "moje"     && <MyShifts />}
      {tab === "slobodne" && <OpenShiftsMarket />}
      {tab === "zahtevi"  && <Swaps />}
    </Screen>
  );
}

// ── Moje smene ────────────────────────────────────────────────────────────────

function MyShifts() {
  const { data, isLoading, error } = useMyShifts();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Smene trenutno nisu dostupne." />;
  if (!data?.length) return <Empty text="Nemaš zakazanih smena." />;

  return <>{data.map(s => <ShiftCard key={s.id} shift={s} />)}</>;
}

function ShiftCard({ shift }: { shift: WaiterShift }) {
  const { user } = useAuth();
  const mine = shift.assignments.find(a => a.waiterId === user?.id);

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <DateChip date={shift.date} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{shift.venue.name}</Text>
          <Text className="text-neutral-400 text-xs mt-0.5 font-normal">
            {shift.startTime}–{shift.endTime}
            {shift.pay ? ` · ${shift.pay.toLocaleString("sr-RS")} RSD` : ""}
          </Text>
        </View>
      </View>

      {/* The owner writes this to be read shortly before the shift, so it is the
          one thing on the card that must not be truncated away. */}
      {shift.briefingNote && (
        <View className="rounded-xl px-3 py-2 mt-3" style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}>
          <Text className="text-[9px] font-bold text-orange-700">BRIFING</Text>
          <Text className="text-neutral-600 text-xs mt-0.5 font-normal">{shift.briefingNote}</Text>
        </View>
      )}

      <View className="flex-row items-center justify-between mt-3">
        <StaffingBarWrap shift={shift} />
        {mine && <ClockControl shiftId={shift.id} assignment={mine} />}
      </View>
    </Card>
  );
}

function StaffingBarWrap({ shift }: { shift: WaiterShift }) {
  return (
    <View className="flex-1 mr-3">
      <StaffingBar filled={shift.assignments.length} required={shift.requiredCount} />
    </View>
  );
}

/**
 * Clock in / out.
 *
 * Device location is out of scope for v1, so no coordinates are sent and the
 * route takes its manager-approval path — every clock-in from this app lands as
 * `pendingClockIn` and the owner has to approve it. That is expected behaviour,
 * not a failure, so it gets its own visible state rather than an error.
 *
 * When QR clock-in ships (mobile-app-plan §2) this is where the scanned venue
 * code goes, and the pending state stops being the normal case.
 */
function ClockControl({ shiftId, assignment }: {
  shiftId:    string;
  assignment: WaiterShift["assignments"][number];
}) {
  const clockIn  = useClockIn();
  const clockOut = useClockOut();

  if (assignment.clockOutAt) return <TonePill tone="neutral">Odjavljen ✓</TonePill>;
  if (assignment.pendingClockIn || clockIn.data?.pending) {
    return <TonePill tone="amber">Čekamo odobrenje…</TonePill>;
  }
  if (assignment.clockInAt) {
    return (
      <SecondaryButton
        label={clockOut.isPending ? "…" : "Odjavi se"}
        disabled={clockOut.isPending}
        onPress={() => clockOut.mutate(shiftId)}
      />
    );
  }

  return (
    <PrimaryButton
      label={clockIn.isPending ? "…" : "Check-in"}
      disabled={clockIn.isPending}
      onPress={() => clockIn.mutate(shiftId)}
    />
  );
}

// ── Slobodne smene ────────────────────────────────────────────────────────────

function OpenShiftsMarket() {
  const { data, isLoading, error } = useOpenShifts();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Slobodne smene trenutno nisu dostupne." />;
  if (!data?.length) return <Empty text="Nema slobodnih smena." />;

  return <>{data.map(s => <OpenShiftCard key={s.id} shift={s} />)}</>;
}

function OpenShiftCard({ shift }: { shift: OpenShift }) {
  const claim = useClaimShift();

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar name={shift.venue.name} size={36} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{shift.venue.name}</Text>
          <Text className="text-neutral-400 text-xs mt-0.5 font-normal">
            {shift.date} · {shift.startTime}–{shift.endTime}
            {shift.role ? ` · ${shift.role}` : ""}
          </Text>
        </View>
      </View>

      <View className="mt-3">
        <StaffingBar filled={shift.assignments.length} required={shift.requiredCount} />
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-neutral-900 font-bold text-xs">
          {shift.pay ? `${shift.pay.toLocaleString("sr-RS")} RSD` : "Po dogovoru"}
          {shift.tipEstimate ? (
            <Text className="text-neutral-400 font-normal"> + ~{shift.tipEstimate} bakšiš</Text>
          ) : null}
        </Text>
        <PrimaryButton
          label={claim.isSuccess ? "✓ Preuzeto" : claim.isPending ? "…" : "Preuzmi"}
          disabled={claim.isPending || claim.isSuccess}
          onPress={() => claim.mutate(shift.id)}
        />
      </View>

      {claim.error && (
        <Text className="text-red-500 text-[11px] mt-2 font-normal">{(claim.error as Error).message}</Text>
      )}
    </Card>
  );
}

// ── Zahtevi (swaps) ───────────────────────────────────────────────────────────

function Swaps() {
  const { data, isLoading, error } = useSwapRequests();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Zahtevi trenutno nisu dostupni." />;
  if (!data?.length) return <Empty text="Nema zahteva za zamenu." />;

  return <>{data.map(s => <SwapRow key={s.id} swap={s} />)}</>;
}

function SwapRow({ swap }: { swap: SwapRequest }) {
  return (
    <Card>
      <Text className="text-neutral-900 font-bold text-sm">
        {swap.fromAssignment.waiter.name ?? "Kolega"} želi da preuzmeš smenu
      </Text>
      <Text className="text-neutral-500 text-xs mt-1 font-normal">
        {swap.shift.venue.name} · {swap.shift.date} · {swap.shift.startTime}–{swap.shift.endTime}
      </Text>
      {/* Read-only on purpose: a swap is resolved by the venue owner, not by the
          waiter receiving it (PATCH /api/shifts/swaps/[id] is VENUE_OWNER-only). */}
      <View className="flex-row mt-3">
        <TonePill tone="amber">Čeka odobrenje vlasnika</TonePill>
      </View>
    </Card>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function DateChip({ date }: { date: string }) {
  const d = new Date(date);
  const valid = !Number.isNaN(d.getTime());

  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: 42, height: 42, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}
    >
      <Text className="text-orange-500 font-extrabold text-sm leading-4">
        {valid ? d.getDate() : "—"}
      </Text>
      <Text className="text-orange-300 font-bold text-[8px]">
        {valid ? d.toLocaleDateString("sr-Latn-RS", { month: "short" }).toUpperCase() : ""}
      </Text>
    </View>
  );
}

function Loading() {
  return (
    <View className="py-8 items-center">
      <ActivityIndicator color="#f97316" />
    </View>
  );
}
