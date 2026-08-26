import "../global.css";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@ekonobar/shared/design-tokens";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached reads are the offline story (mobile-app-plan.md §1): a waiter in a
      // basement kitchen should still see their schedule. Nothing is garbage
      // collected for a day so a cold start offline has data to render.
      gcTime:    24 * 60 * 60 * 1000,
      staleTime: 30 * 1000,
      retry:     1,
    },
  },
});

// AsyncStorage, not SecureStore: this is cached API responses, not credentials,
// and SecureStore has a small per-item size limit that a shift list would blow.
const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * Sends the user to the right half of the app whenever the session changes.
 *
 * Kept in a child of AuthProvider rather than in AuthProvider itself, because
 * expo-router's navigation hooks are only valid beneath the layout that mounts
 * the navigator.
 */
function AuthGate() {
  const { user } = useAuth();
  const segments  = useSegments();
  const router    = useRouter();

  useEffect(() => {
    if (user === undefined) return; // still reading the stored session

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup)     router.replace("/(auth)/login");
    else if (user && inAuthGroup)  router.replace("/(app)");
  }, [user, segments, router]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.shell.bg }}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <AuthProvider>
          {/* The shell is dark on every screen, so the status bar is light everywhere. */}
          <StatusBar style="light" />
          <AuthGate />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
