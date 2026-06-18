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
import { withSpan } from "@/lib/core/observability";
import { sendPush } from "@/lib/integrations/webpush";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/sms";

export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };

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
              await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
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
      } catch {
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
      } catch {
        span.setAttribute("delivered", false);
        return false;
      }
    },
  );
}
