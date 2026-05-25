/**
 * Notification retry helpers — used exclusively by the retry-notifications cron.
 *
 * Each function handles dispatch + DB status update as an atomic unit so the
 * cron remains a pure orchestrator with zero channel-specific logic.
 *
 * Role-bypass parity with notify(): non-WAITER roles skip tier gating,
 * matching the behaviour of the initial send.
 */

import { db } from "@/lib/db";
import {
  isPro     as isPassportPro,
  isProPlus as isPassportProPlus,
  type PassportTierSource,
} from "@/lib/passport-tier";
import { dispatchWhatsApp, dispatchSms } from "@/lib/notify-dispatch";

export async function retryWhatsApp(
  notificationId: string,
  phone: string,
  role: string,
  passport: PassportTierSource | null,
  title: string,
  body: string,
): Promise<"sent" | "failed" | "skipped"> {
  const eligible = role !== "WAITER" || isPassportPro(passport);
  if (!eligible) return "skipped";

  const ok = await dispatchWhatsApp(phone, title, body);
  await db.notification.update({
    where: { id: notificationId },
    data:  ok ? { waSent: true } : { waRetries: { increment: 1 } },
  });
  return ok ? "sent" : "failed";
}

export async function retrySms(
  notificationId: string,
  phone: string,
  role: string,
  passport: PassportTierSource | null,
  title: string,
  body: string,
  link?: string | null,
): Promise<"sent" | "failed" | "skipped"> {
  const eligible = role !== "WAITER" || isPassportProPlus(passport);
  if (!eligible) return "skipped";

  const ok = await dispatchSms(phone, title, body, link ?? undefined);
  await db.notification.update({
    where: { id: notificationId },
    data:  ok ? { smsSent: true } : { smsRetries: { increment: 1 } },
  });
  return ok ? "sent" : "failed";
}
