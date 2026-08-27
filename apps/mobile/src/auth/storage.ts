/**
 * Session persistence.
 *
 * Tokens go in expo-secure-store (iOS Keychain / Android Keystore), never in
 * AsyncStorage — AsyncStorage is plaintext on disk and readable on a rooted or
 * jailbroken device, and a refresh token is a 60-day credential.
 *
 * The cached copy in memory exists because every request reads the session and
 * Keychain access is a native round trip; it is written on every save and cleared
 * on sign-out, so it cannot go stale.
 */

import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { RoleValue, VerificationTierValue } from "@ekonobar/shared/enums";

const SESSION_KEY  = "ekonobar.session";
const DEVICE_ID_KEY = "ekonobar.deviceId";

export type SessionUser = {
  id:               string;
  email:            string;
  name:             string | null;
  role:             RoleValue;
  verificationTier: VerificationTierValue;
  tourCompleted:    boolean;
};

export type Session = {
  accessToken:  string;
  refreshToken: string;
  user:         SessionUser;
};

let cached: Session | null | undefined;

export async function loadSession(): Promise<Session | null> {
  if (cached !== undefined) return cached;

  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    // A corrupt or undecryptable entry is not recoverable and not worth crashing
    // the app over — treat it as "signed out" and let the user log in again.
    cached = null;
  }

  return cached;
}

export async function saveSession(session: Session): Promise<void> {
  cached = session;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

/**
 * A stable id for this install.
 *
 * Generated once and kept in secure storage rather than read from the hardware:
 * device identifiers are restricted on both platforms and are the kind of thing
 * App Review asks about. The server only needs it to group refresh tokens and
 * push tokens per install, which a random value does just as well.
 *
 * Deliberately NOT cleared on sign-out — the identity of the phone does not
 * change because a different person logs in on it.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}
