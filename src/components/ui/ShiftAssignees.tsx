import { getInitials } from "@/lib/formatting/utils";

/**
 * Assignee name chips for a shift, shown to whoever manages the schedule
 * (owner, head waiter, head chef). Replaces the initials-only avatars that made
 * it impossible to tell at a glance who was actually working a shift.
 *
 * Each chip carries the full name plus a small initials avatar. Clock-in state
 * is encoded in the chip itself: green + pulsing dot when the person is on the
 * clock right now, a muted "završio" when they have clocked out, amber "čeka
 * odobrenje" while a manual clock-in is pending.
 *
 * Deliberately minimal shape so both `VenueShiftAssignment` and
 * `ManagedShiftAssignment` are assignable without a cross-file type merge.
 */
export type ShiftAssignee = {
  id: string;
  waiter: { name: string | null };
  clockInAt?: string | null;
  clockOutAt?: string | null;
  pendingClockIn?: boolean;
};

function chipClasses(a: ShiftAssignee): string {
  const working  = a.clockInAt && !a.clockOutAt;
  const finished = a.clockInAt && a.clockOutAt;
  if (working)  return "bg-green-50 text-green-700 border-green-200";
  if (finished) return "bg-neutral-100 text-neutral-500 border-neutral-200";
  if (a.pendingClockIn) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-orange-50 text-orange-700 border-orange-200";
}

export function ShiftAssignees({ assignments }: { assignments: ShiftAssignee[] }) {
  if (assignments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {assignments.map((a) => {
        const working = a.clockInAt && !a.clockOutAt;
        return (
          <span
            key={a.id}
            className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full border text-xs font-semibold ${chipClasses(a)}`}
          >
            <span className="w-5 h-5 rounded-full bg-white/70 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
              {getInitials(a.waiter.name)}
            </span>
            <span className="truncate max-w-[10rem]">{a.waiter.name ?? "Konobar"}</span>
            {working && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
            {a.pendingClockIn && <span className="text-[9px] font-bold">čeka</span>}
          </span>
        );
      })}
    </div>
  );
}
