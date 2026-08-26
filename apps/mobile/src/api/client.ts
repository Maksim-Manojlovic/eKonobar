/**
 * The single HTTP door out of the app.
 *
 * Everything that talks to the backend goes through `api()`. It attaches the
 * access token, refreshes it exactly once on a 401, and signs the user out when
 * the refresh itself fails.
 *
 * The part worth reading carefully is the single-flight refresh. Access tokens
 * live 15 minutes, so when one expires it is normal for several requests to be
 * in the air at once — a screen that loads shifts, notifications and the passport
 * together will get three simultaneous 401s. Refreshing per request would burn
 * three refresh tokens against a rotating single-use endpoint: the first would
 * succeed and the other two would present an already-consumed token, which the
 * server correctly reads as theft and answers by revoking the whole device chain.
 * The user would be signed out for opening a tab.
 *
 * So the first 401 starts a refresh and every other caller awaits that same
 * promise, then retries with the new token.
 */

import Constants from "expo-constants";
import { clearSession, loadSession, saveSession, type Session } from "@/auth/storage";

/** Set via EXPO_PUBLIC_API_URL; falls back to the value baked into app.json extra. */
const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The `x-request-id` the server stamped, so a report can be tied to a server log. */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Raised when the session is gone for good and the UI must return to login. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, "Sesija je istekla. Prijavi se ponovo.");
    this.name = "SessionExpiredError";
  }
}

type Listener = () => void;
const signOutListeners = new Set<Listener>();

/** AuthProvider subscribes so an expired session pops the user back to login. */
export function onForcedSignOut(fn: Listener): () => void {
  signOutListeners.add(fn);
  return () => signOutListeners.delete(fn);
}

async function forceSignOut(): Promise<never> {
  await clearSession();
  for (const fn of signOutListeners) fn();
  throw new SessionExpiredError();
}

// ── Single-flight refresh ─────────────────────────────────────────────────────

let refreshInFlight: Promise<Session> | null = null;

function refreshSession(current: Session): Promise<Session> {
  // Concurrent 401s share one refresh. See the file header for why this matters.
  refreshInFlight ??= (async () => {
    const res = await fetch(`${BASE_URL}/api/mobile/auth/refresh`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!res.ok) throw new SessionExpiredError();

    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    const next: Session = { ...current, ...body };
    await saveSession(next);
    return next;
  })().finally(() => {
    // Cleared in `finally` rather than on success: leaving a rejected promise
    // cached would make every later refresh fail for the lifetime of the app.
    refreshInFlight = null;
  });

  return refreshInFlight;
}

// ── Request ───────────────────────────────────────────────────────────────────

export type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Set for the login/register calls, which must not attach or refresh a token. */
  anonymous?: boolean;
};

async function request<T>(path: string, options: ApiOptions, isRetry: boolean): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;

  const session = anonymous ? null : await loadSession();
  if (!anonymous && !session) await forceSignOut();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !anonymous && !isRetry && session) {
    // Refresh once, then replay. `isRetry` guarantees this cannot recurse: a 401
    // on the replayed request means the fresh token is genuinely not accepted.
    try {
      await refreshSession(session);
    } catch {
      await forceSignOut();
    }
    return request<T>(path, options, true);
  }

  if (res.status === 401 && !anonymous) await forceSignOut();

  const requestId = res.headers.get("x-request-id") ?? undefined;

  if (!res.ok) {
    // Error bodies are `{ error: string }` across the API, but a proxy or a crash
    // can return HTML — never let a parse failure mask the real status.
    let message = `Greška ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) message = parsed.error;
    } catch {
      // Keep the status-derived message.
    }
    throw new ApiError(res.status, message, requestId);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Perform an API call. Throws ApiError on any non-2xx. */
export function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return request<T>(path, options, false);
}

export const apiGet   = <T,>(path: string) => api<T>(path);
export const apiPost  = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST",   body });
export const apiPatch = <T,>(path: string, body?: unknown) => api<T>(path, { method: "PATCH",  body });
export const apiPut   = <T,>(path: string, body?: unknown) => api<T>(path, { method: "PUT",    body });
export const apiDelete = <T,>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });

export { BASE_URL };
