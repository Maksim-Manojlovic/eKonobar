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
import {
  dispatchWhatsApp,
  dispatchSms,
  dispatchDevicePush,
  type DeviceTokenRow,
} from "@/lib/notifications/dispatch";

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

/**
 * Retries a native push.
 *
 * Web push has no retry — a browser that missed one is usually closed anyway.
 * Native push does, because for a mobile user it is the only channel that
 * actually reaches them, and the common failure is a transient Expo outage
 * rather than a dead device. Permanently dead tokens never reach here: they are
 * deleted by dispatchDevicePush on DeviceNotRegistered, which drops the user out
 * of the cron's query.
 */
export async function retryDevicePush(
  notificationId: string,
  tokens: DeviceTokenRow[],
  title: string,
  body: string,
  link?: string | null,
): Promise<"sent" | "failed"> {
  const ok = await dispatchDevicePush(tokens, { title, body, link: link ?? undefined });
  await db.notification.update({
    where: { id: notificationId },
    data:  ok ? { devicePushSent: true } : { devicePushRetries: { increment: 1 } },
  });
  return ok ? "sent" : "failed";
}
