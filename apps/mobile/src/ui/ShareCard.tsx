import { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "@ekonobar/shared/design-tokens";
import { BASE_URL } from "@/api/client";
import { useShareLink } from "@/api/queries";
import { Card } from "./Screen";

/**
 * Public passport link.
 *
 * The link points at the web app, which serves /passport/[shareToken] with no
 * auth — that is the whole point: a venue owner reads it without an account.
 * BASE_URL is the API origin, and in every deployment the API and the web app
 * are the same origin, so it is also the right host for a public page URL.
 *
 * Regenerating is the only way to revoke. POST issues a fresh token over the
 * old one, so the previously shared link dies the moment a new one exists —
 * said out loud here, because a waiter cutting off a venue needs to know that
 * pressing this button is what does it.
 */
export function ShareCard({ shareToken, shareTokenExpiry }: {
  shareToken:       string | null;
  shareTokenExpiry: string | null;
}) {
  const share = useShareLink();
  const [copied, setCopied] = useState(false);

  const url     = shareToken ? `${BASE_URL}/passport/${shareToken}` : null;
  const expiry  = shareTokenExpiry ? new Date(shareTokenExpiry) : null;
  const expired = expiry ? expiry.getTime() < Date.now() : false;
  const live    = !!url && !expired;

  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const openSheet = async () => {
    if (!url) return;
    try {
      await Share.share({ message: `Moj eKonobar pasoš: ${url}`, url });
    } catch {
      // The user dismissing the sheet lands here on some platforms. Nothing to
      // report — cancelling a share is not a failure.
    }
  };

  const generate = () => {
    const run = () => share.mutate(undefined, {
      onError: (err: unknown) =>
        Alert.alert("Nije uspelo", err instanceof Error ? err.message : "Pokušaj ponovo."),
    });

    if (!live) return run();

    Alert.alert(
      "Napraviti novi link?",
      "Postojeći link prestaje da radi. Ko god ga ima više neće moći da otvori tvoj pasoš.",
      [
        { text: "Otkaži", style: "cancel" },
        { text: "Napravi novi", style: "destructive", onPress: run },
      ],
    );
  };

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 font-bold text-sm">Javni link</Text>
        {live && expiry && (
          <Text className="text-neutral-400 text-[10.5px] font-normal">
            Važi do {expiry.toLocaleDateString("sr-Latn-RS")}
          </Text>
        )}
      </View>

      <Text className="text-neutral-400 text-[11px] font-normal mt-1">
        Lokal može da vidi tvoj pasoš bez naloga.
      </Text>

      {live ? (
        <>
          <Pressable
            onPress={copy}
            className="rounded-xl px-3 py-2.5 mt-2.5"
            style={{ backgroundColor: "#fafaf8", borderWidth: 1, borderColor: "#e5e5e3" }}
          >
            <Text className="text-neutral-600 text-[11px] font-normal" numberOfLines={1}>
              {url}
            </Text>
          </Pressable>

          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={copy}
              className="flex-1 rounded-xl items-center py-2.5"
              style={{ backgroundColor: "#fafaf8", borderWidth: 1, borderColor: "#e5e5e3" }}
            >
              <Text className="text-neutral-600 font-bold text-xs">
                {copied ? "Kopirano ✓" : "Kopiraj"}
              </Text>
            </Pressable>
            <Pressable
              onPress={openSheet}
              className="flex-1 rounded-xl items-center py-2.5"
              style={{ backgroundColor: colors.primary[500] }}
            >
              <Text className="text-white font-bold text-xs">Pošalji</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text className="text-neutral-400 text-[11px] font-normal mt-2">
          {expired ? "Prethodni link je istekao." : "Još nemaš link."}
        </Text>
      )}

      <Pressable onPress={generate} disabled={share.isPending} className="items-center py-2 mt-1">
        <Text className="text-orange-600 text-[11px] font-bold">
          {share.isPending
            ? "Pravim…"
            : live ? "Napravi novi link" : "Napravi link"}
        </Text>
      </Pressable>
    </Card>
  );
}
