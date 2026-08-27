/**
 * Native push registration.
 *
 * The server side of this shipped in phase 2 — DeviceToken, the Expo dispatcher,
 * the retry cron — and nothing called it, so no phone could ever ring. This is
 * the missing half.
 *
 * Everything here is best effort and must never throw into a render. Push can
 * fail for reasons that are entirely normal and none of which should cost the
 * user the app:
 *
 *   - running in Expo Go, which dropped remote push in SDK 53;
 *   - no EAS projectId yet, because `eas init` has not been run;
 *   - the user declined the permission prompt;
 *   - a simulator, which has no push token at all.
 *
 * Each of those is logged once and skipped.
 */

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { getDeviceId } from "@/auth/storage";

/** Expo needs the EAS project id to mint a push token; `eas init` writes it. */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export type PushSetupResult =
  | { ok: true;  token: string }
  | { ok: false; reason: "no-device" | "no-project-id" | "denied" | "unavailable" };

/**
 * Asks for permission, obtains an Expo push token and registers it.
 *
 * Safe to call on every cold start, and it should be: Expo tokens rotate, so
 * re-registering is the normal case rather than an error. The server upserts on
 * the token, so repeat calls are cheap.
 */
export async function registerForPush(): Promise<PushSetupResult> {
  // A simulator has no push token. Checking first turns a confusing native error
  // into a clear skip.
  if (!Device.isDevice) return { ok: false, reason: "no-device" };

  const projectId = easProjectId();
  if (!projectId) {
    console.warn("[push] no EAS projectId — run `eas init`. Skipping registration.");
    return { ok: false, reason: "no-project-id" };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    // Only prompt when we have not already been answered; iOS shows the system
    // dialog once and silently denies afterwards.
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") return { ok: false, reason: "denied" };

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    token = res.data;
  } catch (err) {
    // Expo Go on SDK 53+ lands here. So does a missing/invalid projectId.
    console.warn("[push] could not obtain an Expo push token:", err);
    return { ok: false, reason: "unavailable" };
  }

  await api("/api/mobile/push/register", {
    method: "POST",
    body: {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceId: await getDeviceId(),
    },
  });

  return { ok: true, token };
}

/**
 * Removes this install's token server-side.
 *
 * Must run BEFORE the session is cleared: the endpoint is authenticated, so a
 * cleared session means the call 401s and the token is left behind, and the
 * phone keeps receiving notifications for an account nobody is signed into.
 */
export async function unregisterFromPush(): Promise<void> {
  if (!Device.isDevice) return;

  const projectId = easProjectId();
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api("/api/mobile/push/unregister", { method: "DELETE", body: { token } });
  } catch (err) {
    // Sign-out must not be blocked by push cleanup. The token is scoped to the
    // user server-side, and the retry cron prunes what the provider rejects.
    console.warn("[push] unregister failed, continuing sign-out:", err);
  }
}

/**
 * Android requires an explicit channel or notifications arrive silently and
 * without the brand colour. iOS ignores this.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name:             "Obaveštenja",
    importance:       Notifications.AndroidImportance.DEFAULT,
    lightColor:       "#f97316",
    vibrationPattern: [0, 250, 250, 250],
  });
}
