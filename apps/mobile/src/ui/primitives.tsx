import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@ekonobar/shared/design-tokens";
import { getInitials } from "@ekonobar/shared/formatting/utils";
import {
  APPLICATION_STATUS_LABELS_WAITER,
  INVITE_STATUS_LABELS,
  VERIFICATION_LABELS,
  isVerified,
} from "@ekonobar/shared/formatting/labels";

/**
 * The small pieces every waiter screen is built from, ported from the design
 * prototype in design/ui.jsx and design/ui-dark.jsx.
 *
 * Colours come from @ekonobar/shared/design-tokens, and every label comes from
 * @ekonobar/shared/formatting/labels — the prototype hard-coded both, which is
 * exactly the drift the shared package exists to stop.
 */

// ── Pill ──────────────────────────────────────────────────────────────────────

export function Pill({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <View className="rounded-full px-2 py-1" style={{ backgroundColor: bg }}>
      <Text className="text-[10px] font-extrabold" style={{ color: fg }}>{children}</Text>
    </View>
  );
}

const TONES = {
  neutral: { bg: "#fafaf8", fg: "#78716c" },
  green:   { bg: "#dcfce7", fg: "#166534" },
  amber:   { bg: "#fef9c3", fg: "#854d0e" },
  red:     { bg: "#fee2e2", fg: "#991b1b" },
  blue:    { bg: "#dbeafe", fg: "#1d4ed8" },
  orange:  { bg: "#fff7ed", fg: "#c2410c" },
} as const;

export type Tone = keyof typeof TONES;

export function TonePill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return <Pill bg={t.bg} fg={t.fg}>{children}</Pill>;
}

// ── Status badges ─────────────────────────────────────────────────────────────

const APPLICATION_TONE: Record<string, Tone> = {
  ACCEPTED: "green", COMPLETED: "green", SHORTLISTED: "blue",
  PENDING: "amber", REJECTED: "red", WITHDRAWN: "neutral",
};

export function ApplicationStatusBadge({ status }: { status: string }) {
  return (
    <TonePill tone={APPLICATION_TONE[status] ?? "neutral"}>
      {APPLICATION_STATUS_LABELS_WAITER[status] ?? status}
    </TonePill>
  );
}

const INVITE_TONE: Record<string, Tone> = {
  ACCEPTED: "green", PENDING: "amber", DECLINED: "red", EXPIRED: "neutral",
};

export function InviteStatusBadge({ status }: { status: string }) {
  return (
    <TonePill tone={INVITE_TONE[status] ?? "neutral"}>
      {INVITE_STATUS_LABELS[status] ?? status}
    </TonePill>
  );
}

/**
 * Verification, rendered as evidence rather than as a rank.
 *
 * The design prototype drew a BRONZE→PLATINUM ladder. Those values do not exist
 * in VerificationTier, and GOLD (an owner vouched via invite code) is not
 * "better than" ID_VERIFIED (a government ID was checked) — so this is a binary
 * badge plus the name of what was actually proven.
 */
export function VerifiedBadge({ tier }: { tier: string }) {
  if (!isVerified(tier)) return <TonePill tone="neutral">Neverifikovan</TonePill>;
  return <TonePill tone="blue">✓ {VERIFICATION_LABELS[tier] ?? "Verifikovan"}</TonePill>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size, height: size, borderRadius: size * 0.32,
        backgroundColor: colors.primary[500],
      }}
    >
      <Text className="text-white font-extrabold" style={{ fontSize: size * 0.4 }}>
        {getInitials(name ?? "")}
      </Text>
    </View>
  );
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

export function ScoreRing({ score, size = 72, label = "SKOR" }: {
  score: number; size?: number; label?: string;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0efec" strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.primary[500]} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          strokeLinecap="round"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-neutral-900 font-black" style={{ fontSize: size * 0.28 }}>
          {Math.round(score)}
        </Text>
        <Text className="text-neutral-400 font-semibold" style={{ fontSize: size * 0.11 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ── StaffingBar ───────────────────────────────────────────────────────────────

/** filled/required with a red → amber → green ramp. Ported from the prototype. */
export function StaffingBar({ filled, required }: { filled: number; required: number }) {
  const pct   = required > 0 ? filled / required : 0;
  const color = pct === 0 ? "#f87171" : pct < 1 ? "#fbbf24" : "#22c55e";

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e5e3" }}>
        <View style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, backgroundColor: color }} />
      </View>
      <Text className="text-[10px] font-bold text-neutral-500">{filled}/{required}</Text>
    </View>
  );
}

// ── SegmentTabs ───────────────────────────────────────────────────────────────

export function SegmentTabs<T extends string>({ tabs, active, onChange }: {
  tabs:     ReadonlyArray<{ id: T; label: string }>;
  active:   T;
  onChange: (id: T) => void;
}) {
  return (
    <View
      className="flex-row rounded-xl p-0.5 mx-5 mb-3"
      style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
    >
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            className="flex-1 items-center rounded-lg py-2"
            style={on ? { backgroundColor: colors.primary[500] } : undefined}
          >
            <Text
              className="text-[11px] font-bold"
              style={{ color: on ? "#fff" : "rgba(255,255,255,0.5)" }}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

export function PrimaryButton({ label, onPress, disabled }: {
  label: string; onPress?: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="rounded-xl px-4 py-2.5 items-center"
      style={{ backgroundColor: disabled ? colors.primary[300] : colors.primary[500] }}
    >
      <Text className="text-white font-bold text-xs">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: {
  label: string; onPress?: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="rounded-xl px-4 py-2.5 items-center bg-white"
      style={{ borderWidth: 1.5, borderColor: "#e5e5e3", opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="text-neutral-700 font-semibold text-xs">{label}</Text>
    </Pressable>
  );
}

// ── Empty / error states ──────────────────────────────────────────────────────

export function Empty({ text }: { text: string }) {
  return (
    <View className="items-center py-8">
      <Text className="text-white/40 text-xs">{text}</Text>
    </View>
  );
}
