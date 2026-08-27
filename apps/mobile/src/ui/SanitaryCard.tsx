import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { colors } from "@ekonobar/shared/design-tokens";
import { pickImage, uploadAsset, useSanitaryBook, useSubmitSanitary } from "@/api/upload";
import { Card } from "./Screen";
import { TonePill } from "./primitives";

/**
 * Sanitary book — submit, and see where the submission got to.
 *
 * The document is uploaded first (POST /api/upload, type sanitary-doc, which
 * accepts a PDF as well as a photo), then the returned URL is submitted for
 * review. Re-submitting is an upsert that resets the record to PENDING and
 * clears the previous reviewer's decision, so "Pošalji ponovo" is the correct
 * action after a rejection rather than a separate flow.
 */

const STATUS: Record<string, { tone: "green" | "amber" | "red" | "neutral"; label: string }> = {
  APPROVED: { tone: "green",   label: "Odobrena" },
  PENDING:  { tone: "amber",   label: "Čeka proveru" },
  REJECTED: { tone: "red",     label: "Odbijena" },
  EXPIRED:  { tone: "neutral", label: "Istekla" },
};

export function SanitaryCard() {
  const { data: record, isLoading } = useSanitaryBook();
  const submit = useSubmitSanitary();

  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expiry, setExpiry] = useState("");
  const [open, setOpen]     = useState(false);

  const status = record ? STATUS[record.status] ?? STATUS.PENDING : null;

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const asset = await pickImage();
      if (!asset) return;                        // user backed out of the picker
      const fileUrl = await uploadAsset(asset, "sanitary-doc");
      await submit.mutateAsync({
        fileUrl,
        expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(expiry.trim()) ? expiry.trim() : null,
      });
      setOpen(false);
      setExpiry("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Otpremanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 font-bold text-sm">Sanitarna knjižica</Text>
        {isLoading
          ? <ActivityIndicator color={colors.primary[500]} />
          : status
            ? <TonePill tone={status.tone}>{status.label}</TonePill>
            : <TonePill tone="neutral">Nije poslata</TonePill>}
      </View>

      {record?.expiryDate && (
        <Text className="text-neutral-400 text-[11px] mt-1 font-normal">
          Važi do {new Date(record.expiryDate).toLocaleDateString("sr-Latn-RS")}
        </Text>
      )}

      {/* The admin's reason is the whole point of a rejection — surface it. */}
      {record?.status === "REJECTED" && record.rejectReason && (
        <View className="rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
          <Text className="text-red-700 text-[11px] font-normal">{record.rejectReason}</Text>
        </View>
      )}

      {open ? (
        <View className="mt-3 gap-2">
          <Text className="text-neutral-600 font-semibold text-[12px]">Datum isteka (opciono)</Text>
          <TextInput
            value={expiry}
            onChangeText={setExpiry}
            placeholder="2027-05-01"
            placeholderTextColor="#a3a3a0"
            autoCapitalize="none"
            className="rounded-xl px-3 text-neutral-900 font-normal"
            style={{ backgroundColor: "#fafaf8", borderWidth: 1, borderColor: "#e5e5e3", paddingVertical: 10, fontSize: 14 }}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={send}
              disabled={busy}
              className="flex-1 rounded-xl items-center py-3"
              style={{ backgroundColor: busy ? colors.primary[300] : colors.primary[500] }}
            >
              <Text className="text-white font-bold text-xs">
                {busy ? "Otpremam…" : "Izaberi i pošalji"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setOpen(false); setError(null); }}
              disabled={busy}
              className="rounded-xl items-center justify-center px-4 bg-white"
              style={{ borderWidth: 1.5, borderColor: "#e5e5e3" }}
            >
              <Text className="text-neutral-600 font-semibold text-xs">Otkaži</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setOpen(true)} className="mt-3 rounded-xl items-center py-2.5" style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}>
          <Text className="text-orange-700 font-bold text-xs">
            {record ? "Pošalji ponovo" : "Pošalji knjižicu"}
          </Text>
        </Pressable>
      )}

      {error && <Text className="text-red-500 text-[11px] mt-2 font-normal">{error}</Text>}
    </Card>
  );
}
