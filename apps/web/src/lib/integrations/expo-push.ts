/**
 * Expo push service — the native counterpart to lib/integrations/webpush.ts.
 *
 * Expo fronts both APNs and FCM behind one token format and one HTTP endpoint,
 * so no Apple .p8 key or FCM service account lives in this codebase; those are
 * uploaded once to the Expo project. That is the whole reason for choosing it
 * over talking to APNs and FCM directly.
 *
 * There is no env var to configure and therefore nothing to no-op on: the
 * function is only ever called with tokens, and no DeviceToken rows exist until
 * a real app install registers one. Development and tests hit zero tokens and
 * so make zero network calls.
 *
 * `EXPO_ACCESS_TOKEN` is optional. Setting it enables Expo's "enhanced security"
 * mode, which rejects sends that do not carry it — worth turning on once the
 * app is in the stores, so a leaked push token cannot be used to spam users.
 */

import logger from "@/lib/core/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo rejects requests carrying more than 100 messages. */
const MAX_BATCH = 100;

export type ExpoPushPayload = {
  title: string;
  body:  string;
  link?: string;
};

export type ExpoPushOutcome = {
  /** How many messages Expo accepted. */
  delivered: number;
  /**
   * Tokens Expo rejected as permanently dead (uninstalled app, token rotated).
   * The caller deletes these — retrying them can never succeed.
   */
  invalidTokens: string[];
};

type ExpoTicket =
  | { status: "ok"; id?: string }
  | { status: "error"; message?: string; details?: { error?: string } };

/** `ExponentPushToken[xxx]` is the current form; `ExpoPushToken[xxx]` is the legacy one. */
export function isExpoPushToken(token: string): boolean {
  return /^Exp(o|onent)PushToken\[[^\]]+\]$/.test(token);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Sends one notification to many device tokens.
 *
 * Throws only when the transport itself fails — a per-message rejection is
 * reported through the return value, because one dead token must not stop the
 * other recipients from getting the notification.
 */
export async function sendExpoPush(
  tokens: string[],
  payload: ExpoPushPayload,
): Promise<ExpoPushOutcome> {
  const outcome: ExpoPushOutcome = { delivered: 0, invalidTokens: [] };
  if (tokens.length === 0) return outcome;

  const accessToken = process.env.EXPO_ACCESS_TOKEN;

  for (const batch of chunk(tokens, MAX_BATCH)) {
    const messages = batch.map((to) => ({
      to,
      title: payload.title,
      body:  payload.body,
      sound: "default" as const,
      // The app maps `link` onto an expo-router path — same link string the web
      // notification uses, so the server has one notion of "where this points".
      data: payload.link ? { link: payload.link } : {},
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type":    "application/json",
        "accept-encoding": "gzip, deflate",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      throw new Error(`Expo push failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];

    // Tickets come back positionally, one per message in the batch.
    tickets.forEach((ticket, i) => {
      if (ticket.status === "ok") {
        outcome.delivered++;
        return;
      }
      if (ticket.details?.error === "DeviceNotRegistered") {
        outcome.invalidTokens.push(batch[i]);
        return;
      }
      logger.warn(
        { channel: "device-push", error: ticket.details?.error, message: ticket.message },
        "expo push ticket rejected",
      );
    });
  }

  return outcome;
}
