import "../global.css";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
  Lexend_900Black,
} from "@expo-google-fonts/lexend";
import { colors } from "@ekonobar/shared/design-tokens";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";

// Hold the native splash until Lexend is in memory. Without this the first
// frame renders in the iOS system font and then reflows once the font lands,
// which reads as a broken screen rather than a loading one.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or the module is unavailable — not worth failing a launch over.
});

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

    // Route groups in parentheses do not appear in the URL: (auth)/welcome.tsx is
    // "/welcome" and (app)/index.tsx is "/". Navigating to "/(app)" happens to
    // work in some expo-router versions and silently does nothing in others.
    //
    // The signed-out landing is /welcome, not /login — the auth group cannot have
    // its own index.tsx, because that would claim "/" alongside the app's index
    // and the two would collide.
    if (!user && !inAuthGroup)    router.replace("/welcome");
    else if (user && inAuthGroup) router.replace("/");
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
  const [fontsLoaded, fontError] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
    Lexend_900Black,
  });

  const onReady = useCallback(() => {
    // Hide on font error too: shipping the system font is far better than a
    // splash screen that never goes away.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  useEffect(() => { onReady(); }, [onReady]);

  if (!fontsLoaded && !fontError) return null;

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
