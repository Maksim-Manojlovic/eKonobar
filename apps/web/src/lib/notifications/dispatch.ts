/**
 * Low-level notification channel dispatchers.
 *
 * Each function performs the network send only — no DB writes, no tier checks.
 * Returns a boolean: true = delivered, false = failed.
 *
 * Imported by notify.ts (coordinator) and notify-retry.ts (cron retry helpers).
 * Never import directly from route handlers — use notify() or fireSideEffects().
 */

import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { withSpan } from "@/lib/core/observability";
import { sendPush } from "@/lib/integrations/webpush";
import { sendExpoPush } from "@/lib/integrations/expo-push";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/sms";

export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };
export type DeviceTokenRow = { id: string; token: string };

/**
 * Canonical SMS body formatter (≤160 chars).
 * Shared by dispatchSms and the retry cron so both produce identical output.
 */
export function buildSmsText(title: string, body: string, link?: string | null): string {
  return `${title}: ${body}${link ? " | ekonobar.rs" : ""}`.slice(0, 160);
}

/**
 * Sends web push to all active subscriptions.
 * Auto-deletes stale subs (410/404).
 * Returns true when at least one push was delivered.
 */
export async function dispatchPush(
  subs: PushSub[],
  payload: { title: string; body: string; link?: string },
): Promise<boolean> {
  if (subs.length === 0) return false;

  return withSpan(
    { name: "notification.push", op: "notification.dispatch", attributes: { channel: "push", subs: subs.length } },
    async (span) => {
      const results = await Promise.allSettled(
        subs.map(sub =>
          sendPush(sub, payload).catch(async (err: { statusCode?: number }) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db.pushSubscription.delete({ where: { id: sub.id } })
                .catch(delErr => logger.warn({ err: delErr, subId: sub.id }, "expired push-sub cleanup failed"));
            }
            throw err;
          }),
        ),
      );
      const delivered = results.some(r => r.status === "fulfilled");
      span.setAttribute("delivered", delivered);
      return delivered;
    },
  );
}

/**
 * Sends WhatsApp template message.
 * Returns true on delivery, false on failure.
 */
export async function dispatchWhatsApp(
  phone: string,
  title: string,
  body: string,
): Promise<boolean> {
  return withSpan(
    { name: "notification.whatsapp", op: "notification.dispatch", attributes: { channel: "whatsapp" } },
    async (span) => {
      try {
        await sendWhatsApp(phone, title, body);
        span.setAttribute("delivered", true);
        return true;
      } catch (err) {
        // Must log: the boolean alone makes a rejected Meta template, an expired
        // WA_ACCESS_TOKEN and a plain rate-limit indistinguishable from "not
        // opted in" — and the retry cron then re-fires 3× with no diagnostic.
        logger.warn({ err, channel: "whatsapp" }, "whatsapp dispatch failed");
        span.setAttribute("delivered", false);
        return false;
      }
    },
  );
}

/**
 * Sends Infobip SMS (≤160 chars).
 * Returns true on delivery, false on failure.
 */
export async function dispatchSms(
  phone: string,
  title: string,
  body: string,
  link?: string,
): Promise<boolean> {
  return withSpan(
    { name: "notification.sms", op: "notification.dispatch", attributes: { channel: "sms" } },
    async (span) => {
      try {
        await sendSms(phone, buildSmsText(title, body, link));
        span.setAttribute("delivered", true);
        return true;
      } catch (err) {
        logger.warn({ err, channel: "sms" }, "sms dispatch failed");
        span.setAttribute("delivered", false);
        return false;
      }
    },
  );
}

/**
 * Sends a native push to every registered device of one user, via Expo.
 *
 * Mirrors dispatchPush: network only, returns whether anything was delivered,
 * and prunes tokens the provider reports as permanently dead — the native
 * equivalent of deleting a web subscription on 410/404. Without that pruning a
 * user who uninstalls the app leaves a row that is retried forever.
 */
export async function dispatchDevicePush(
  tokens: DeviceTokenRow[],
  payload: { title: string; body: string; link?: string },
): Promise<boolean> {
  if (tokens.length === 0) return false;

  return withSpan(
    {
      name: "notification.device_push",
      op: "notification.dispatch",
      attributes: { channel: "device-push", tokens: tokens.length },
    },
    async (span) => {
      try {
        const outcome = await sendExpoPush(tokens.map(t => t.token), payload);

        if (outcome.invalidTokens.length > 0) {
          await db.deviceToken
            .deleteMany({ where: { token: { in: outcome.invalidTokens } } })
            .catch(err => logger.warn({ err }, "dead device-token cleanup failed"));
        }

        const delivered = outcome.delivered > 0;
        span.setAttribute("delivered", delivered);
        return delivered;
      } catch (err) {
        // Same reasoning as WhatsApp: the boolean alone cannot distinguish an
        // Expo outage from "no devices registered", and the retry cron would
        // then re-fire three times with no diagnostic.
        logger.warn({ err, channel: "device-push" }, "device push dispatch failed");
        span.setAttribute("delivered", false);
        return false;
      }
    },
  );
}
