import { useState } from "react";
import { Alert, Text, View } from "react-native";
import type { LeaveRequestRow } from "@ekonobar/shared/api/venue";
import { DEPARTMENT_LABELS } from "@ekonobar/shared/formatting/labels";
import { usePrimaryVenue } from "@/api/venue-queries";
import { useResolveLeave, useVenueLeaveRequests } from "@/api/leave-queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, SegmentTabs } from "@/ui/primitives";
import { LeaveStatusBadge, formatRange, leaveTypeLabel } from "@/ui/leave-kit";

/**
 * Odmori — the manager's queue.
 *
 * The API already scopes rows to the departments this manager covers, so there
 * is no filtering to redo here. Pending first is the API's own ordering
 * (status asc, then startDate) and it is the right one: this screen exists to
 * clear decisions, and history is the secondary tab.
 */

type Tab = "pending" | "all";

export default function OwnerOdmoriScreen() {
  const { venue } = usePrimaryVenue();
  const { data, isLoading } = useVenueLeaveRequests(venue?.id);
  const resolve = useResolveLeave();

  const [tab, setTab] = useState<Tab>("pending");

  if (!venue)   return <Screen title="Odmori"><Empty text="Nemaš registrovan lokal." /></Screen>;
  if (isLoading) return <Screen title="Odmori"><Empty text="Učitavanje…" /></Screen>;

  const all     = data?.requests ?? [];
  const pending = all.filter(r => r.status === "PENDING");
  const rows    = tab === "pending" ? pending : all;

  const approve = (r: LeaveRequestRow) =>
    resolve.mutate({ id: r.id, action: "approve" });

  // The reject reason is what the worker sees, so it is asked for rather than
  // assumed. Alert.prompt is iOS-only; on Android the fallback confirms and
  // sends no reason, which the route accepts (rejectReason is nullish).
  const reject = (r: LeaveRequestRow) => {
    const send = (rejectReason: string | null) =>
      resolve.mutate({ id: r.id, action: "reject", rejectReason });

    if (Alert.prompt) {
      Alert.prompt(
        "Razlog odbijanja",
        `${r.waiter.name ?? "Radnik"} · ${formatRange(r.startDate, r.endDate)}`,
        [
          { text: "Otkaži", style: "cancel" },
          { text: "Odbij", style: "destructive", onPress: (text?: string) => send(text?.trim() || null) },
        ],
        "plain-text",
      );
      return;
    }

    Alert.alert("Odbiti zahtev?", `${r.waiter.name ?? "Radnik"} · ${formatRange(r.startDate, r.endDate)}`, [
      { text: "Otkaži", style: "cancel" },
      { text: "Odbij", style: "destructive", onPress: () => send(null) },
    ]);
  };

  return (
    <Screen title="Odmori" subtitle={venue.name}>
      <SegmentTabs
        tabs={[
          { id: "pending" as Tab, label: `Na čekanju${pending.length ? ` (${pending.length})` : ""}` },
          { id: "all" as Tab,     label: "Sve" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {rows.length === 0 ? (
        <Empty text={tab === "pending" ? "Nema zahteva na čekanju." : "Još nema zahteva."} />
      ) : (
        rows.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            busy={resolve.isPending}
            onApprove={() => approve(r)}
            onReject={() => reject(r)}
          />
        ))
      )}
    </Screen>
  );
}

function RequestCard({ request: r, busy, onApprove, onReject }: {
  request:   LeaveRequestRow;
  busy:      boolean;
  onApprove: () => void;
  onReject:  () => void;
}) {
  return (
    <Card>
      <View className="flex-row items-start gap-2.5">
        <Avatar name={r.waiter.name} uri={r.waiter.image} size={38} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-[13px]">
            {r.waiter.name ?? "Radnik"}
          </Text>
          <Text className="text-neutral-400 text-[11px] font-normal mt-0.5">
            {r.staff.position} · {DEPARTMENT_LABELS[r.department] ?? r.department}
          </Text>
        </View>
        <LeaveStatusBadge status={r.status} />
      </View>

      <View className="mt-2.5">
        <Text className="text-neutral-900 font-semibold text-[12.5px]">
          {leaveTypeLabel(r.type)}
        </Text>
        <Text className="text-neutral-400 text-[11.5px] font-normal mt-0.5">
          {formatRange(r.startDate, r.endDate)} · {r.days} {r.days === 1 ? "dan" : "dana"}
        </Text>
      </View>

      {r.reason && (
        <Text className="text-neutral-500 text-[11.5px] font-normal mt-2">{r.reason}</Text>
      )}

      {r.status === "REJECTED" && r.rejectReason && (
        <View className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
          <Text className="text-red-700 text-[11px] font-normal">{r.rejectReason}</Text>
        </View>
      )}

      {r.status === "PENDING" && (
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1">
            <PrimaryButton label="Odobri" onPress={onApprove} disabled={busy} />
          </View>
          <View className="flex-1">
            <SecondaryButton label="Odbij" onPress={onReject} disabled={busy} />
          </View>
        </View>
      )}
    </Card>
  );
}
