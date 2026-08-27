import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { ROLE_LABELS, VERIFICATION_LABELS, isVerified } from "@ekonobar/shared/formatting/labels";
import { colors } from "@ekonobar/shared/design-tokens";
import { useNotificationPrefs, useUpdateNotificationPrefs } from "@/api/queries";
import { useAuth } from "@/auth/AuthProvider";
import { Card, Screen } from "@/ui/Screen";
import { Empty } from "@/ui/primitives";

/**
 * Settings — account, notification channels, sign out.
 *
 * The channels are the point. WhatsApp and SMS were fully built server-side and
 * no mobile screen touched /api/user/notification-prefs, so a phone user had no
 * way to switch them on — the same built-but-inert gap push registration had.
 *
 * Both channels need a phone number, and the server treats a missing one as
 * "not opted in" regardless of the flag, so the toggles are disabled until one
 * is saved rather than silently doing nothing.
 */
export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { data: prefs, isLoading, error } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  const [phone, setPhone] = useState("");
  const [dirty, setDirty] = useState(false);

  // Seed the field once the server value arrives, but never clobber something
  // the user is mid-way through typing.
  useEffect(() => {
    if (prefs && !dirty) setPhone(prefs.phone ?? "");
  }, [prefs, dirty]);

  const hasPhone = (prefs?.phone ?? "").trim().length > 0;

  return (
    <Screen title="Podešavanja" subtitle={user?.email}>
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color={colors.primary[500]} /></View>}
      {error && <Empty text="Podešavanja trenutno nisu dostupna." />}

      {prefs && (
        <>
          <Card>
            <Text className="text-neutral-900 font-bold mb-2">Nalog</Text>
            <Row label="Ime"  value={user?.name ?? "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Tip"  value={user ? ROLE_LABELS[user.role] ?? user.role : "—"} />
            <Row
              label="Verifikacija"
              value={
                user && isVerified(user.verificationTier)
                  ? VERIFICATION_LABELS[user.verificationTier] ?? "Verifikovan"
                  : "Neverifikovan"
              }
            />
          </Card>

          <Card>
            <Text className="text-neutral-900 font-bold">Obaveštenja</Text>
            <Text className="text-neutral-400 text-[11px] mt-1 mb-3 font-normal">
              Push stiže uvek. WhatsApp i SMS traže broj telefona.
            </Text>

            <Text className="text-neutral-600 font-semibold text-[12px] mb-1.5">Broj telefona</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={phone}
                onChangeText={v => { setPhone(v); setDirty(true); }}
                placeholder="+381 60 000 0000"
                placeholderTextColor="#a3a3a0"
                keyboardType="phone-pad"
                className="flex-1 rounded-xl px-3 text-neutral-900 font-normal"
                style={{
                  backgroundColor: "#fafaf8", borderWidth: 1, borderColor: "#e5e5e3",
                  paddingVertical: 10, fontSize: 14,
                }}
              />
              <Pressable
                onPress={() => {
                  update.mutate({ phone: phone.trim() || null });
                  setDirty(false);
                }}
                disabled={!dirty || update.isPending}
                className="rounded-xl px-4 justify-center"
                style={{ backgroundColor: dirty ? colors.primary[500] : "#e5e5e3" }}
              >
                <Text className="font-bold text-xs" style={{ color: dirty ? "#fff" : "#a3a3a0" }}>
                  Sačuvaj
                </Text>
              </Pressable>
            </View>

            <Toggle
              label="WhatsApp"
              hint={hasPhone ? undefined : "Dodaj broj telefona"}
              value={prefs.waOptIn}
              disabled={!hasPhone || update.isPending}
              onChange={v => update.mutate({ waOptIn: v })}
            />
            <Toggle
              label="SMS"
              hint={hasPhone ? undefined : "Dodaj broj telefona"}
              value={prefs.smsOptIn}
              disabled={!hasPhone || update.isPending}
              onChange={v => update.mutate({ smsOptIn: v })}
            />

            {update.error && (
              <Text className="text-red-500 text-[11px] mt-2 font-normal">
                {(update.error as Error).message}
              </Text>
            )}
          </Card>

          <Card>
            <Pressable onPress={signOut} className="items-center py-1">
              <Text className="text-red-600 font-bold text-sm">Odjavi se</Text>
            </Pressable>
          </Card>

          <Text className="text-white/25 text-[11px] text-center font-normal">
            eKonobar v{Constants.expoConfig?.version ?? "0.1.0"} · Beograd
          </Text>
        </>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-neutral-400 text-xs font-normal">{label}</Text>
      <Text className="text-neutral-900 text-xs font-semibold flex-1 text-right" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Toggle({ label, hint, value, disabled, onChange }: {
  label: string; hint?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-2.5" style={{ borderTopWidth: 1, borderTopColor: "#f5f4f0" }}>
      <View className="flex-1">
        <Text className={disabled ? "text-neutral-400 font-semibold text-[13px]" : "text-neutral-900 font-semibold text-[13px]"}>
          {label}
        </Text>
        {hint && <Text className="text-orange-500 text-[10px] mt-0.5 font-normal">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: "#e5e5e3", true: colors.primary[500] }}
      />
    </View>
  );
}
