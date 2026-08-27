import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { ensureAndroidChannel, registerForPush } from "./push";
import { mapNotificationLink } from "./links";

/**
 * Foreground presentation.
 *
 * Set at module scope because Expo reads it when a notification arrives, which
 * can be before any component has mounted. Without it a notification that lands
 * while the app is open is delivered silently — the user sees nothing and only
 * finds out by opening the bell.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

/**
 * Registers this device for push and routes taps.
 *
 * Registration runs whenever a user is signed in, including every cold start,
 * because Expo tokens rotate — re-registering is the normal case, not an error.
 * It is fire-and-forget: a failure is logged inside registerForPush and must not
 * stop the app rendering.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const router   = useRouter();
  const qc       = useQueryClient();

  // Guards against re-registering on every render caused by an unrelated state
  // change; the user id is the thing that actually matters.
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      registeredFor.current = null;
      return;
    }
    if (registeredFor.current === user.id) return;
    registeredFor.current = user.id;

    ensureAndroidChannel().catch(() => undefined);
    registerForPush().catch(err => console.warn("[push] registration failed:", err));
  }, [user]);

  useEffect(() => {
    // A notification arriving while the app is open means the bell count and the
    // feed are both stale.
    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    });

    // Fires when the user taps one, whether the app was backgrounded or cold.
    const tapped = Notifications.addNotificationResponseReceivedListener(response => {
      const link = response.notification.request.content.data?.link as string | undefined;
      qc.invalidateQueries({ queryKey: ["notifications"] });
      router.push(mapNotificationLink(link));
    });

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [router, qc]);
}
