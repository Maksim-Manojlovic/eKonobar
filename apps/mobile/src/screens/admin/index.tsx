import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { timeAgo } from "@ekonobar/shared/formatting/utils";
import type { SanitaryPending } from "@ekonobar/shared/api/admin";
import { useResolveSanitary, useSanitaryPending } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, TonePill } from "@/ui/primitives";

/**
 * Admin — sanitary-book verifications.
 *
 * The admin surface on the phone is a thin action inbox, not a port of the web
 * dashboard (mobile-app-plan §11): only the things that are time-sensitive and
 * resolve in one tap. Users, venues, zones and every chart stay on the web.
 *
 * The document itself is deliberately not shown. The route omits `fileUrl` and
 * serves the scan through an auth-gated endpoint instead, so approving from the
 * phone means approving on the metadata — expiry date and who submitted it.
 * Anything needing a look at the scan belongs on the web.
 */
export default function AdminHomeScreen() {
  const { data, isLoading, error } = useSanitaryPending();

  return (
    <Screen title="Odobrenja" subtitle="Sanitarne knjižice">
      {isLoading && <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>}
      {error && <Empty text="Podaci trenutno nisu dostupni." />}
      {data?.length === 0 && <Empty text="Nema zahteva na čekanju." />}
      {data?.map(item => <SanitaryRow key={item.id} item={item} />)}
    </Screen>
  );
}

function SanitaryRow({ item }: { item: SanitaryPending }) {
  const resolve = useResolveSanitary();
  const [rejecting, setRejecting] = useState(false);

  const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
  const expired = expiry ? expiry.getTime() < Date.now() : false;

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar name={item.user.name} size={36} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">
            {item.user.name ?? item.user.email}
          </Text>
          <Text className="text-neutral-400 text-[11px] mt-0.5">
            Poslato {timeAgo(item.uploadedAt)}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5 mt-2">
        {expiry
          ? (
            <TonePill tone={expired ? "red" : "neutral"}>
              {expired ? "Istekla " : "Važi do "}
              {expiry.toLocaleDateString("sr-Latn-RS")}
            </TonePill>
          )
          : <TonePill tone="amber">Bez datuma isteka</TonePill>}
      </View>

      {/* An already-expired book is the one case worth refusing outright, so it
          is called out rather than left for the admin to spot in a date. */}
      {expired && (
        <Text className="text-red-500 text-[11px] mt-2">
          Knjižica je već istekla — odobravanje bi odmah bilo nevažeće.
        </Text>
      )}

      <View className="flex-row gap-2 mt-3">
        <View className="flex-1">
          <PrimaryButton
            label={resolve.isPending ? "…" : "Odobri"}
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ id: item.id, action: "approve" })}
          />
        </View>
        <View className="flex-1">
          <SecondaryButton
            label={rejecting ? "Potvrdi odbijanje" : "Odbij"}
            disabled={resolve.isPending}
            onPress={() => {
              // Two taps to reject: rejecting clears the waiter's
              // sanitaryBookValid flag, and a mis-tap on a small button should
              // not silently cost someone their verification.
              if (!rejecting) { setRejecting(true); return; }
              resolve.mutate({
                id: item.id,
                action: "reject",
                rejectReason: "Odbijeno iz mobilne aplikacije",
              });
            }}
          />
        </View>
      </View>

      {resolve.error && (
        <Text className="text-red-500 text-[11px] mt-2">{(resolve.error as Error).message}</Text>
      )}
    </Card>
  );
}
