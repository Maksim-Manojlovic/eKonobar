import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api, onForcedSignOut } from "@/api/client";
import { clearSession, getDeviceId, loadSession, saveSession, type Session, type SessionUser } from "./storage";

type AuthState = {
  /** undefined while the stored session is still being read on cold start. */
  user:    SessionUser | null | undefined;
  signIn:  (email: string, password: string) => Promise<void>;
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

  const signOut = useCallback(async () => {
    const stored = await loadSession();

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

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
