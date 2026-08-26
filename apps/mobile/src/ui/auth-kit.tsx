import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@ekonobar/shared/design-tokens";

/**
 * Auth-flow pieces, ported from design/screens-auth.jsx.
 *
 * The auth screens are LIGHT — a near-white ground with white cards — while the
 * rest of the app is the dark #120a00 shell. That is deliberate in the design,
 * so these do not reuse the Screen/Card primitives.
 */

export const AUTH_BG = "#f2f2f7";

export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        backgroundColor: colors.primary[500],
      }}
    >
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 20 20">
        <Path
          d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z"
          fill="#fff" opacity={0.95}
        />
        <Circle cx={10} cy={8.5} r={2.2} fill="#fff" />
      </Svg>
    </View>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label?: string }) {
  return (
    <View>
      {label && (
        <Text className="text-neutral-600 font-semibold text-[12.5px] mb-1.5">{label}</Text>
      )}
      <TextInput
        placeholderTextColor="#a3a3a0"
        className="rounded-xl px-3.5 text-neutral-900 font-normal"
        style={{
          backgroundColor: "#fff",
          borderWidth: 1.5, borderColor: "#e5e5e3",
          paddingVertical: 13, fontSize: 14.5,
        }}
        {...rest}
      />
    </View>
  );
}

export function BigButton({ label, onPress, disabled, variant = "primary" }: {
  label: string; onPress?: () => void; disabled?: boolean; variant?: "primary" | "secondary";
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="rounded-2xl items-center"
      style={{
        paddingVertical: 16,
        backgroundColor: primary ? (disabled ? colors.primary[300] : colors.primary[500]) : "#fff",
        ...(primary ? null : { borderWidth: 1.5, borderColor: "#e5e5e3" }),
      }}
    >
      <Text
        className={primary ? "font-bold text-base" : "font-semibold text-base"}
        style={{ color: primary ? "#fff" : "#404040" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BackChevron({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} className="w-8 h-8 justify-center">
      <Svg width={13} height={22} viewBox="0 0 12 20">
        <Path
          d="M10 2L2 10l8 8" stroke={colors.primary[500]} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      </Svg>
    </Pressable>
  );
}

export function StepHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  return (
    <View>
      <View className="flex-row items-center">
        <BackChevron onPress={onBack} />
        <Text className="flex-1 text-center text-neutral-900 font-bold text-[15px]" style={{ marginLeft: -32 }}>
          Korak {step} od {total}
        </Text>
      </View>
      <View className="h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "#e6e5e1" }}>
        <View
          style={{
            height: "100%", width: `${(step / total) * 100}%`,
            backgroundColor: colors.primary[500], borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}

export function RoleCard({ selected, title, subtitle, icon, onPress, disabled }: {
  selected?: boolean; title: string; subtitle: string; icon: ReactNode;
  onPress?: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 rounded-2xl p-3.5"
      style={{
        borderWidth: 2,
        borderColor: selected ? colors.primary[500] : "#e5e5e3",
        backgroundColor: selected ? "#fff7ed" : "#fff",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        className="items-center justify-center rounded-xl mb-2.5"
        style={{ width: 34, height: 34, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}
      >
        {icon}
      </View>
      <Text className="text-neutral-900 font-bold text-[13.5px]">{title}</Text>
      <Text className="text-neutral-400 text-[11px] mt-0.5 font-normal">{subtitle}</Text>
    </Pressable>
  );
}
