import { Text, View } from "react-native";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_SHORT,
} from "@ekonobar/shared/formatting/labels";
import { TonePill, type Tone } from "./primitives";

/** Shared between the worker's history and the manager's queue. */

const STATUS_TONE: Record<string, Tone> = {
  PENDING:   "amber",
  APPROVED:  "green",
  REJECTED:  "red",
  CANCELLED: "neutral",
};

export function LeaveStatusBadge({ status }: { status: string }) {
  return (
    <TonePill tone={STATUS_TONE[status] ?? "neutral"}>
      {LEAVE_STATUS_LABELS[status] ?? status}
    </TonePill>
  );
}

export const leaveTypeLabel  = (t: string) => LEAVE_TYPE_LABELS[t] ?? t;
export const leaveTypeShort  = (t: string) => LEAVE_TYPE_SHORT[t] ?? t;

/**
 * "14. sep – 18. sep 2026." — one year, printed once.
 *
 * A range crossing New Year never reaches here as one row: the API splits it
 * into one request per leave year so each draws from the right balance.
 */
export function formatRange(startDate: string, endDate: string): string {
  const opts = { day: "numeric", month: "short" } as const;
  const from = new Date(startDate);
  const to   = new Date(endDate);
  const same = startDate === endDate;

  const left  = from.toLocaleDateString("sr-Latn-RS", opts);
  const right = to.toLocaleDateString("sr-Latn-RS", opts);
  const year  = to.getFullYear();

  return same ? `${left} ${year}.` : `${left} – ${right} ${year}.`;
}

/** A labelled number, used for the balance grid. */
export function LeaveStat({ label, value, tone }: {
  label: string;
  value: number;
  tone?: "muted";
}) {
  return (
    <View className="items-center">
      <Text
        className="font-black"
        style={{ fontSize: 20, color: tone === "muted" ? "#a3a3a0" : "#171717" }}
      >
        {value}
      </Text>
      <Text className="text-neutral-400 text-[10.5px] font-semibold mt-0.5">{label}</Text>
    </View>
  );
}
