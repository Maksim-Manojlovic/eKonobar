import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "@ekonobar/shared/design-tokens";
import { pickImage, uploadAsset } from "@/api/upload";
import { useSetVenueImages } from "@/api/venue-queries";
import { Card } from "./Screen";

const MAX_PHOTOS = 8;   // matches the .max(8) on the route's images array

/**
 * Venue gallery.
 *
 * The route replaces the whole `images` array, so both add and remove send the
 * full list. That means the current array has to come in as a prop — deriving
 * it inside would race the invalidation and drop a photo added a moment ago.
 */
export function VenuePhotos({ venueId, images }: { venueId: string; images: string[] }) {
  const setImages = useSetVenueImages();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const asset = await pickImage();
      if (!asset) return;
      const url = await uploadAsset(asset, "venue-photo");
      await setImages.mutateAsync({ venueId, images: [...images, url] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Otpremanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (url: string) =>
    Alert.alert("Obriši fotografiju?", undefined, [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: () => {
          setImages.mutate({ venueId, images: images.filter(i => i !== url) });
        },
      },
    ]);

  const full = images.length >= MAX_PHOTOS;

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-neutral-900 font-bold text-sm">Fotografije</Text>
        <Text className="text-neutral-400 text-[11px] font-normal">
          {images.length}/{MAX_PHOTOS}
        </Text>
      </View>

      {images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map(url => (
            <Pressable key={url} onLongPress={() => remove(url)}>
              <Image
                source={{ uri: url }}
                style={{ width: 108, height: 80, borderRadius: 12, backgroundColor: "#f0f0ee" }}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={add}
        disabled={busy || full}
        className="mt-3 rounded-xl items-center py-2.5"
        style={{
          backgroundColor: full ? "#f5f5f3" : "#fff7ed",
          borderWidth: 1,
          borderColor: full ? "#e5e5e3" : "#fed7aa",
        }}
      >
        <Text
          className="font-bold text-xs"
          style={{ color: full ? "#a3a3a0" : colors.primary[700] }}
        >
          {full ? "Dostignut limit" : busy ? "Otpremam…" : "Dodaj fotografiju"}
        </Text>
      </Pressable>

      {images.length > 0 && (
        <Text className="text-neutral-300 text-[10.5px] mt-2 font-normal text-center">
          Drži prst na fotografiji da je obrišeš
        </Text>
      )}

      {error && <Text className="text-red-500 text-[11px] mt-2 font-normal">{error}</Text>}
    </Card>
  );
}
