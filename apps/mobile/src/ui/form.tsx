import type { ReactNode } from "react";
import { Pressable, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@ekonobar/shared/design-tokens";

/**
 * Form pieces for the dark app shell.
 *
 * Separate from ui/auth-kit, which is light — the auth flow is drawn on a
 * near-white ground and everything behind the tab bar is on #120a00. Same
 * component names would be a trap, so these are explicitly the dark set.
 */

export function FormField({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View>
      <Text className="text-white/60 font-semibold text-[12px] mb-1.5">{label}</Text>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.3)"
        className="rounded-xl px-3.5 text-white font-normal"
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1, borderColor: colors.shell.border,
          paddingVertical: 12, fontSize: 14.5,
        }}
        {...rest}
      />
      {hint && <Text className="text-white/30 text-[10.5px] mt-1 font-normal">{hint}</Text>}
    </View>
  );
}

/** Single-choice chips. A dropdown on a phone is a modal for no reason. */
export function ChipPicker<T extends string>({ label, options, value, onChange }: {
  label:    string;
  options:  ReadonlyArray<{ value: T; label: string }>;
  value:    T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View>
      <Text className="text-white/60 font-semibold text-[12px] mb-1.5">{label}</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {options.map(o => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              className="rounded-full px-3 py-2"
              style={{
                backgroundColor: on ? colors.primary[500] : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: on ? colors.primary[500] : colors.shell.border,
              }}
            >
              <Text
                className="text-[11.5px] font-bold"
                style={{ color: on ? "#fff" : "rgba(255,255,255,0.65)" }}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-white font-semibold text-[13px]">{label}</Text>
        {hint && <Text className="text-white/35 text-[10.5px] mt-0.5 font-normal">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(255,255,255,0.12)", true: colors.primary[500] }}
      />
    </View>
  );
}

export function SubmitButton({ label, onPress, disabled, busy }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className="rounded-2xl items-center py-3.5"
      style={{ backgroundColor: disabled ? colors.primary[300] : colors.primary[500] }}
    >
      <Text className="text-white font-bold text-sm">{busy ? "Čuvam…" : label}</Text>
    </Pressable>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Text className="text-red-400 text-xs font-normal">
      {error instanceof Error ? error.message : "Greška. Pokušaj ponovo."}
    </Text>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-white/85 font-extrabold text-[13px]">{title}</Text>
      {children}
    </View>
  );
}

/**
 * Date entry without a native picker.
 *
 * Quick chips cover almost every real case — a shift is nearly always within the
 * next few days — and the field stays editable for anything further out. Adding
 * a native date picker would be another module to verify against Expo Go, for a
 * control that is slower to use on this particular form.
 */
export function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const days = [0, 1, 2, 3, 7].map(offset => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const label =
      offset === 0 ? "Danas" :
      offset === 1 ? "Sutra" :
      d.toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" });
    return { value: iso, label };
  });

  return (
    <View className="gap-2">
      <FormField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="2026-09-15"
        hint="Format: GGGG-MM-DD"
        autoCapitalize="none"
      />
      <View className="flex-row flex-wrap gap-1.5">
        {days.map(d => {
          const on = value === d.value;
          return (
            <Pressable
              key={d.value}
              onPress={() => onChange(d.value)}
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor: on ? colors.primary[500] : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: on ? colors.primary[500] : colors.shell.border,
              }}
            >
              <Text className="text-[11px] font-bold" style={{ color: on ? "#fff" : "rgba(255,255,255,0.6)" }}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
