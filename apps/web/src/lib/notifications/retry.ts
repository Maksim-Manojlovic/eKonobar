/**
 * Notification retry helpers — used exclusively by the retry-notifications cron.
 *
 * Each function handles dispatch + DB status update as an atomic unit so the
 * cron remains a pure orchestrator with zero channel-specific logic.
 *
 * No eligibility check here: notify() only sets waRetries/smsRetries for sends it
 * actually attempted, so a row reaching retry was already opted in.
 */

import { db } from "@/lib/core/db";
import { dispatchWhatsApp, dispatchSms } from "@/lib/notifications/dispatch";

export async function retryWhatsApp(
  notificationId: string,
  phone: string,
  title: string,
  body: string,
): Promise<"sent" | "failed"> {
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
  title: string,
  body: string,
  link?: string | null,
): Promise<"sent" | "failed"> {
  const ok = await dispatchSms(phone, title, body, link ?? undefined);
  await db.notification.update({
    where: { id: notificationId },
    data:  ok ? { smsSent: true } : { smsRetries: { increment: 1 } },
  });
  return ok ? "sent" : "failed";
}
