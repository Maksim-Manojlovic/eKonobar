import { ActivityIndicator, Text, View } from "react-native";
import type { VenueShift, VenueShiftAssignment, VenueSwapRequest } from "@ekonobar/shared/api/venue";
import { useManagedShifts, useResolveClockIn, useResolveSwap } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, StaffingBar, TonePill } from "@/ui/primitives";

/**
 * Smene — the owner's agenda.
 *
 * A day/agenda list, not the week grid the web dashboard uses: a scheduling grid
 * does not survive a phone-width screen, and the design prototype reached the
 * same conclusion with its month view plus an expanding day brief.
 *
 * The two action blocks are pinned to the top on purpose. Pending clock-ins in
 * particular are load-bearing in v1 — with no device location in the app, every
 * clock-in a waiter makes lands here waiting on this screen. If the owner does
 * not see them, nobody gets clocked in.
 */
export default function OwnerSmeneScreen() {
  const { data, isLoading, error } = useManagedShifts();

  if (isLoading) {
    return <Screen title="Smene"><View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View></Screen>;
  }
  if (error) return <Screen title="Smene"><Empty text="Smene trenutno nisu dostupne." /></Screen>;

  const shifts = data?.shifts ?? [];

  // A 200 with venue: null means this account manages no venue — not an error.
  if (!data?.venue) {
    return <Screen title="Smene"><Empty text="Ne upravljaš nijednim lokalom." /></Screen>;
  }

  const pendingClockIns = shifts.flatMap(s =>
    s.assignments.filter(a => a.pendingClockIn).map(a => ({ shift: s, assignment: a })),
  );
  const pendingSwaps = shifts.flatMap(s =>
    s.swapRequests.filter(r => r.status === "PENDING").map(r => ({ shift: s, swap: r })),
  );

  return (
    <Screen title="Smene">
      {pendingClockIns.length > 0 && (
        <Card>
          <Text className="text-neutral-900 font-bold mb-1">Čeka odobrenje dolaska</Text>
          <Text className="text-neutral-400 text-[11px] mb-2">
            Konobar je prijavio dolazak bez GPS potvrde.
          </Text>
          {pendingClockIns.map(({ shift, assignment }) => (
            <ClockInRow key={assignment.id} shift={shift} assignment={assignment} />
          ))}
        </Card>
      )}

      {pendingSwaps.length > 0 && (
        <Card>
          <Text className="text-neutral-900 font-bold mb-2">Zahtevi za zamenu</Text>
          {pendingSwaps.map(({ shift, swap }) => (
            <SwapRow key={swap.id} shift={shift} swap={swap} />
          ))}
        </Card>
      )}

      {shifts.length === 0
        ? <Empty text="Nema zakazanih smena." />
        : shifts.map(s => <ShiftRow key={s.id} shift={s} />)}
    </Screen>
  );
}

function ClockInRow({ shift, assignment }: { shift: VenueShift; assignment: VenueShiftAssignment }) {
  const resolve = useResolveClockIn();

  return (
    <View className="flex-row items-center gap-2 py-2">
      <Avatar name={assignment.waiter.name} size={30} />
      <View className="flex-1">
        <Text className="text-neutral-700 text-xs font-semibold">
          {assignment.waiter.name ?? "Konobar"}
        </Text>
        <Text className="text-neutral-400 text-[10px]">
          {shift.date} · {shift.startTime}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        <PrimaryButton
          label="Odobri"
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ assignmentId: assignment.id, action: "approve" })}
        />
        <SecondaryButton
          label="Odbij"
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ assignmentId: assignment.id, action: "reject" })}
        />
      </View>
    </View>
  );
}

function SwapRow({ shift, swap }: { shift: VenueShift; swap: VenueSwapRequest }) {
  const resolve = useResolveSwap();

  return (
    <View className="flex-row items-center gap-2 py-2">
      <View className="flex-1">
        <Text className="text-neutral-700 text-xs font-semibold">
          {swap.fromAssignment.waiter.name ?? "?"} → {swap.toWaiter.name ?? "?"}
        </Text>
        <Text className="text-neutral-400 text-[10px]">
          {shift.title} · {shift.date}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        <PrimaryButton
          label="Odobri"
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ swapId: swap.id, action: "ACCEPTED" })}
        />
        <SecondaryButton
          label="Odbij"
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ swapId: swap.id, action: "REJECTED" })}
        />
      </View>
    </View>
  );
}

function ShiftRow({ shift }: { shift: VenueShift }) {
  const clockedIn = shift.assignments.filter(a => a.clockInAt && !a.clockOutAt).length;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 font-bold text-sm">{shift.title}</Text>
        {clockedIn > 0 && <TonePill tone="green">{clockedIn} na smeni</TonePill>}
      </View>
      <Text className="text-neutral-400 text-xs mt-0.5">
        {shift.date} · {shift.startTime}–{shift.endTime}
      </Text>

      <View className="mt-3">
        <StaffingBar filled={shift.assignments.length} required={shift.requiredCount} />
      </View>

      {shift.assignments.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {shift.assignments.map(a => (
            <TonePill key={a.id} tone={a.clockInAt ? "green" : "neutral"}>
              {a.waiter.name ?? "?"}
            </TonePill>
          ))}
        </View>
      )}
    </Card>
  );
}
