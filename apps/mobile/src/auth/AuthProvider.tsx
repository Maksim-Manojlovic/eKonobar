import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api, onForcedSignOut } from "@/api/client";
import { clearSession, getDeviceId, loadSession, saveSession, type Session, type SessionUser } from "./storage";
import { unregisterFromPush } from "@/push/push";

type AuthState = {
  /** undefined while the stored session is still being read on cold start. */
  user:    SessionUser | null | undefined;
  signIn:  (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "facebook", token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  // Cold start: trust the stored session enough to render, then confirm it with
  // the server. Waiting for the network before showing anything would put a
  // spinner in front of a waiter opening the app on a basement kitchen signal.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      setUser(stored?.user ?? null);
      if (!stored) return;

      try {
        const fresh = await api<{ user: SessionUser }>("/api/mobile/me");
        if (!cancelled) {
          setUser(fresh.user);
          await saveSession({ ...stored, user: fresh.user });
        }
      } catch {
        // A dead session is handled by the client's forced-sign-out path below;
        // anything else here is an offline start, where the cached user is right.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // The API client signs out when a refresh fails. Mirror that into React state
  // so the router moves to the login screen instead of rendering an empty app.
  useEffect(() => onForcedSignOut(() => setUser(null)), []);

  const signIn = useCallback(async (email: string, password: string) => {
    const deviceId = await getDeviceId();

    // anonymous: there is no token yet, and a 401 here means "wrong password",
    // not "session expired" — it must not trigger the refresh-or-sign-out path.
    const session = await api<Session>("/api/mobile/auth/login", {
      method:    "POST",
      anonymous: true,
      body: {
        email,
        password,
        deviceId,
        deviceName: Device.modelName ?? undefined,
        platform:   Platform.OS === "ios" ? "ios" : "android",
      },
    });

    await saveSession(session);
    setUser(session.user);
  }, []);

  /**
   * Sign in with a token from a native Google / Facebook flow.
   *
   * The provider SDK is not installed yet — it carries native code, so it needs
   * an EAS development build and, for Google, an iOS and an Android client id
   * that only exist once the app is registered with Apple and Google. See
   * mobile-app-plan.md §8b. The server half is finished and tested, so wiring
   * this up is: install the SDK, put a button on the login screen, hand what it
   * returns to this function.
   *
   * Google's flow yields an ID token; Facebook's an access token. The server
   * verifies whichever it is with the provider before believing any of it.
   */
  const signInWithProvider = useCallback(
    async (provider: "google" | "facebook", token: string) => {
      const deviceId = await getDeviceId();

      // anonymous, for the same reason as signIn: a 401 here means the provider
      // token was rejected, not that a session expired, so it must not kick off
      // the refresh-or-sign-out path.
      const session = await api<Session>("/api/mobile/auth/oauth", {
        method:    "POST",
        anonymous: true,
        body: {
          provider,
          token,
          deviceId,
          deviceName: Device.modelName ?? undefined,
          platform:   Platform.OS === "ios" ? "ios" : "android",
        },
      });

      await saveSession(session);
      setUser(session.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    const stored = await loadSession();

    // Before anything else: /api/mobile/push/unregister is authenticated, so
    // clearing the session first would 401 the call and strand the token —
    // leaving this phone receiving notifications for an account nobody is
    // signed into. It swallows its own failures, so this cannot block sign-out.
    await unregisterFromPush();

    // Best effort: revoke server-side, but never leave the user stuck on a
    // logout screen because the network is down. The local session goes either way.
    if (stored) {
      await api("/api/mobile/auth/logout", {
        method:    "POST",
        anonymous: true,
        body:      { refreshToken: stored.refreshToken },
      }).catch(() => undefined);
    }

    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signInWithProvider, signOut }),
    [user, signIn, signInWithProvider, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
