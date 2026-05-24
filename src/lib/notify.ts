import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { sendPush } from "@/lib/webpush";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSms } from "@/lib/sms";
import { sendNotificationEmail } from "@/lib/email";
import { isPro as isPassportPro, isProPlus as isPassportProPlus } from "@/lib/passport-tier";

// ── Types ─────────────────────────────────────────────────────────────────────

type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Canonical SMS body formatter.
 * Exported so the retry-notifications cron can use the same 160-char format
 * instead of duplicating the template string.
 */
export function buildSmsText(title: string, body: string, link?: string | null): string {
  return `${title}: ${body}${link ? " | ekonobar.rs" : ""}`.slice(0, 160);
}

// ── Per-channel dispatchers ───────────────────────────────────────────────────

/**
 * Sends web push to all active subscriptions.
 * Auto-deletes stale subs (410/404). Returns true when at least one push was delivered.
 */
async function dispatchPush(
  notifId: string,
  subs: PushSub[],
  payload: { title: string; body: string; link?: string },
): Promise<boolean> {
  if (subs.length === 0) return false;

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

  const anySent = results.some(r => r.status === "fulfilled");
  if (anySent) {
    db.notification.update({ where: { id: notifId }, data: { pushSent: true } }).catch(() => {});
  }
  return anySent;
}

/**
 * Sends WhatsApp template message.
 * On failure: increments waRetries so the hourly retry cron can re-attempt (max 3×).
 */
async function dispatchWhatsApp(
  notifId: string,
  phone: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    await sendWhatsApp(phone, title, body);
    db.notification.update({ where: { id: notifId }, data: { waSent: true } }).catch(() => {});
  } catch {
    db.notification.update({
      where: { id: notifId },
      data:  { waRetries: { increment: 1 } },
    }).catch(() => {});
  }
}

/**
 * Sends Infobip SMS (≤160 chars).
 * On failure: increments smsRetries for retry cron. Returns true on delivery.
 */
async function dispatchSms(
  notifId: string,
  phone: string,
  title: string,
  body: string,
  link?: string,
): Promise<boolean> {
  try {
    await sendSms(phone, buildSmsText(title, body, link));
    db.notification.update({ where: { id: notifId }, data: { smsSent: true } }).catch(() => {});
    return true;
  } catch {
    db.notification.update({
      where: { id: notifId },
      data:  { smsRetries: { increment: 1 } },
    }).catch(() => {});
    return false;
  }
}

// ── Coordinator ───────────────────────────────────────────────────────────────

/**
 * Creates an in-app notification record and dispatches to all eligible channels
 * in parallel (push, WhatsApp, SMS, email fallback).
 *
 * Tier gating applies only to WAITER recipients:
 *   - Web push:  free for all tiers
 *   - WhatsApp:  requires active PRO or PRO_PLUS
 *   - SMS:       requires active PRO_PLUS
 * Venue owners and other roles bypass tier gating and receive all opted-in channels.
 *
 * Always call fire-and-forget from request handlers:
 *   notify(userId, ...).catch(console.error);
 */
export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role:     true,
      email:    true,
      phone:    true,
      smsOptIn: true,
      waOptIn:  true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      waiterPassport: { select: { passportTier: true, subscriptionExpiresAt: true } },
    },
  });

  // db already filters deletedAt; null means soft-deleted or missing
  if (!user) return;

  const notification = await db.notification.create({
    data: { userId, type, title, body, link: link ?? null },
  });

  // Tier gating: non-WAITER roles bypass the check and always get full channel access
  const isPro     = user.role !== "WAITER" || isPassportPro(user.waiterPassport);
  const isProPlus = user.role !== "WAITER" || isPassportProPlus(user.waiterPassport);

  const shouldWA  = isPro     && !!user.waOptIn  && !!user.phone;
  const shouldSms = isProPlus && !!user.smsOptIn && !!user.phone;

  // Dispatch push + WhatsApp + SMS in parallel; failures in one channel don't block others
  const [pushResult, , smsResult] = await Promise.allSettled([
    dispatchPush(notification.id, user.pushSubscriptions, { title, body, link }),
    shouldWA  ? dispatchWhatsApp(notification.id, user.phone!, title, body) : Promise.resolve(),
    shouldSms ? dispatchSms(notification.id, user.phone!, title, body, link) : Promise.resolve<boolean>(false),
  ]);

  // Email fallback: only when no channel attempted delivery.
  // Push and WA are considered "attempted" if the conditions were met (retry handles failures).
  // SMS counts only when it actually delivered (no retry for email).
  const pushAttempted = user.pushSubscriptions.length > 0;
  const smsDelivered  = smsResult.status === "fulfilled" && smsResult.value === true;
  const anyDelivered  = pushAttempted || shouldWA || smsDelivered;

  if (!anyDelivered && user.email) {
    sendNotificationEmail({ toEmail: user.email, title, body, link }).catch(() => {});
  }
}
