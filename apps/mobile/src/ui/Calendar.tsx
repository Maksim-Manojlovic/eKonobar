import { useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@ekonobar/shared/design-tokens";
import { StaffingBar } from "./primitives";

/**
 * Month calendar with an inline expanding day brief.
 *
 * Ported from the design prototype (design/ui-dark.jsx CalendarMonth +
 * design/screens-waiter3.jsx DayBrief). This is the shape the Smene screens were
 * drawn around: a month grid where tapping a day opens a detail panel *inside*
 * the grid, under the week it belongs to, rather than pushing a new screen.
 *
 * The week-by-week render is what makes that possible — a plain 7-across wrap
 * has nowhere to put a full-width row without breaking the columns.
 */

const WEEKDAYS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

export type CalendarShift = {
  id:            string;
  /** ISO date or anything Date can parse. */
  date:          string;
  startTime:     string;
  endTime:       string;
  status:        string;
  requiredCount: number;
  assignedCount: number;
  /** The signed-in waiter is on this shift. */
  mine?:         boolean;
  clockedIn?:    boolean;
  swapPending?:  boolean;
};

type Cell = { day: number | null; inMonth: boolean; shifts: CalendarShift[] };

function statusTone(status: string, swapPending?: boolean) {
  if (swapPending)            return { bg: "#fef3c7", fg: "#b45309", label: "Zamena" };
  if (status === "ASSIGNED")  return { bg: "#dcfce7", fg: "#15803d", label: "Popunjena" };
  if (status === "COMPLETED") return { bg: "#e5e7eb", fg: "#4b5563", label: "Završena" };
  if (status === "CANCELLED") return { bg: "#fee2e2", fg: "#991b1b", label: "Otkazana" };
  return { bg: "#ffedd5", fg: "#c2410c", label: "Otvorena" };
}

/** Monday-first grid, which is what Serbia uses — Date.getDay() is Sunday-first. */
function buildCells(year: number, month: number, shifts: CalendarShift[]): Cell[] {
  const first = new Date(year, month, 1);
  const lead  = (first.getDay() + 6) % 7;
  const days  = new Date(year, month + 1, 0).getDate();

  const byDay = new Map<number, CalendarShift[]>();
  for (const s of shifts) {
    const d = new Date(s.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const list = byDay.get(d.getDate()) ?? [];
    list.push(s);
    byDay.set(d.getDate(), list);
  }

  const cells: Cell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ day: null, inMonth: false, shifts: [] });
  for (let d = 1; d <= days; d++) cells.push({ day: d, inMonth: true, shifts: byDay.get(d) ?? [] });
  while (cells.length % 7 !== 0) cells.push({ day: null, inMonth: false, shifts: [] });
  return cells;
}

export function MonthCalendar({ shifts, renderDay }: {
  shifts:    CalendarShift[];
  /** Rendered full-width beneath the week containing the selected day. */
  renderDay: (day: number, shifts: CalendarShift[], close: () => void) => ReactNode;
}) {
  const today = new Date();
  const [cursor, setCursor]   = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<number | null>(null);

  const cells = useMemo(() => buildCells(cursor.y, cursor.m, shifts), [cursor, shifts]);
  const weeks = useMemo(() => {
    const out: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  const isCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const monthLabel = new Date(cursor.y, cursor.m, 1)
    .toLocaleDateString("sr-Latn-RS", { month: "long", year: "numeric" });

  const step = (delta: number) => {
    setSelected(null);
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View className="bg-white rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#f0efec" }}>
      <View className="flex-row items-center justify-between px-4 py-3" style={{ backgroundColor: "#faf5ee" }}>
        <Text className="text-neutral-900 font-extrabold text-sm">{monthLabel}</Text>
        <View className="flex-row items-center gap-3">
          <NavBtn label="‹" onPress={() => step(-1)} />
          <Pressable onPress={() => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelected(null); }}>
            <Text className="text-[10px] font-bold" style={{ color: isCurrentMonth ? "#a3a3a0" : colors.primary[500] }}>
              Danas
            </Text>
          </Pressable>
          <NavBtn label="›" onPress={() => step(1)} />
        </View>
      </View>

      <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: "#f0efec" }}>
        {WEEKDAYS.map(w => (
          <View key={w} style={{ flex: 1 }} className="items-center py-1.5">
            <Text className="text-[9px] font-semibold text-neutral-400">{w}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => {
        const expanded = week.find(c => c.inMonth && c.day === selected);
        return (
          <View key={wi}>
            <View className="flex-row">
              {week.map((c, ci) => (
                <DayCell
                  key={ci}
                  cell={c}
                  isToday={
                    c.inMonth && c.day === today.getDate() &&
                    cursor.y === today.getFullYear() && cursor.m === today.getMonth()
                  }
                  isSelected={c.inMonth && c.day === selected}
                  onPress={() => c.inMonth && setSelected(prev => (prev === c.day ? null : c.day))}
                />
              ))}
            </View>
            {expanded?.day != null && (
              <View style={{ borderBottomWidth: 1, borderBottomColor: "#f5f4f0" }}>
                {renderDay(expanded.day, expanded.shifts, () => setSelected(null))}
              </View>
            )}
          </View>
        );
      })}

      <View className="flex-row flex-wrap gap-3 px-4 py-2.5" style={{ borderTopWidth: 1, borderTopColor: "#f5f4f0" }}>
        {[["#ffedd5", "Slobodna"], ["#dcfce7", "Popunjena"], ["#fef3c7", "Zamena"]].map(([c, l]) => (
          <View key={l} className="flex-row items-center gap-1.5">
            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: c }} />
            <Text className="text-[9px] text-neutral-400 font-normal">{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NavBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text className="text-neutral-400 font-bold text-sm">{label}</Text>
    </Pressable>
  );
}

function DayCell({ cell, isToday, isSelected, onPress }: {
  cell: Cell; isToday: boolean; isSelected: boolean; onPress: () => void;
}) {
  const shift = cell.shifts[0];
  const tone  = shift ? statusTone(shift.status, shift.swapPending) : null;

  const background = !cell.inMonth ? "#faf5ee"
    : isSelected ? "#fff7ed"
    : tone ? tone.bg
    : "#fff";

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, minHeight: 58, padding: 3,
        borderRightWidth: 1, borderRightColor: "#f5f4f0",
        borderBottomWidth: isSelected ? 0 : 1, borderBottomColor: "#f5f4f0",
        backgroundColor: background,
        ...(isSelected ? { borderWidth: 1.5, borderColor: colors.primary[500] } : null),
      }}
    >
      {cell.inMonth && (
        isToday ? (
          <View
            className="items-center justify-center"
            style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary[500] }}
          >
            <Text className="text-white font-extrabold" style={{ fontSize: 9 }}>{cell.day}</Text>
          </View>
        ) : (
          <Text className="text-[9.5px] font-semibold text-neutral-500">{cell.day}</Text>
        )
      )}

      {shift && tone && (
        <View className="mt-1 gap-1">
          <View className="flex-row items-center gap-0.5">
            {shift.clockedIn && (
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#22c55e" }} />
            )}
            {shift.swapPending && <Text style={{ fontSize: 7 }}>🔁</Text>}
            <Text className="font-bold" style={{ fontSize: 8, color: tone.fg }}>{shift.startTime}</Text>
          </View>
          <StaffingBar filled={shift.assignedCount} required={shift.requiredCount} />
          {shift.mine && (
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary[500] }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

/** The panel that opens inside the grid. Actions are injected by the caller. */
export function DayBrief({ title, subtitle, stats, briefing, note, onClose, actions }: {
  title:     string;
  subtitle?: string;
  stats:     Array<{ label: string; value: string; accent?: boolean }>;
  briefing?: string | null;
  note?:     string | null;
  onClose:   () => void;
  actions?:  ReactNode;
}) {
  return (
    <View className="px-3.5 pt-3 pb-3.5" style={{ backgroundColor: "#fffdfa" }}>
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <View className="flex-1">
          <Text className="text-neutral-900 font-extrabold text-[13px]">{title}</Text>
          {subtitle && <Text className="text-neutral-500 text-[11px] font-normal mt-0.5">{subtitle}</Text>}
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text className="text-neutral-400 text-base font-normal">✕</Text>
        </Pressable>
      </View>

      <View className="flex-row gap-2 mb-2.5">
        {stats.map(s => (
          <View
            key={s.label}
            className="flex-1 rounded-xl px-2.5 py-2"
            style={{
              backgroundColor: s.accent ? "#fff7ed" : "#fafaf8",
              borderWidth: 1, borderColor: s.accent ? "#fed7aa" : "#f0efec",
            }}
          >
            <Text
              className="font-bold"
              style={{ fontSize: 9, color: s.accent ? "#c2410c" : "#a3a3a0" }}
            >
              {s.label}
            </Text>
            <Text className="text-neutral-900 font-extrabold text-[13px] mt-0.5">{s.value}</Text>
          </View>
        ))}
      </View>

      {briefing ? (
        <View
          className="rounded-xl px-2.5 py-2 mb-2"
          style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}
        >
          <Text className="font-bold text-orange-700" style={{ fontSize: 9 }}>BRIFING</Text>
          <Text className="text-neutral-600 text-[11.5px] font-normal mt-0.5">{briefing}</Text>
        </View>
      ) : null}

      {note ? (
        <Text className="text-neutral-400 text-[11px] italic font-normal mb-2">{note}</Text>
      ) : null}

      {actions && <View className="flex-row justify-end">{actions}</View>}
    </View>
  );
}
