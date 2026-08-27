import { Image, Text, View } from "react-native";
import { getInitials } from "@ekonobar/shared/formatting/utils";

/**
 * Circular avatar with an initials fallback.
 *
 * Initials come from the shared getInitials so a name renders identically on
 * web and on the phone — there is no second definition of "up to two letters,
 * or a question mark".
 */
export function Avatar({ uri, size, fallback }: {
  uri:       string | null | undefined;
  size:      number;
  fallback?: string | null;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#f0f0ee" }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: "#fff7ed", borderWidth: 1.5, borderColor: "#fed7aa",
      }}
    >
      <Text className="text-orange-600 font-black" style={{ fontSize: size * 0.34 }}>
        {getInitials(fallback ?? "")}
      </Text>
    </View>
  );
}
