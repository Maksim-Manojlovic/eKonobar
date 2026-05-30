import { NotificationType, Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";
import { sendNotificationEmail } from "@/lib/integrations/email";
import {
  isPro          as isPassportPro,
  isProPlus      as isPassportProPlus,
} from "@/lib/passport/tier";
import {
  dispatchPush,
  dispatchWhatsApp,
  dispatchSms,
} from "@/lib/notifications/dispatch";

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

  // Bust the notification list cache so the next poll reflects the new item.
  if (redis) redis.del(`notif:cache:${userId}`).catch(() => {});

  // Tier gating: waiterPassport is always fetched in the user query above.
  // Non-WAITER roles bypass tier gating and receive all opted-in channels.
  const isPro     = user.role !== "WAITER" || isPassportPro(user.waiterPassport);
  const isProPlus = user.role !== "WAITER" || isPassportProPlus(user.waiterPassport);

  const shouldWA  = isPro     && !!user.waOptIn  && !!user.phone;
  const shouldSms = isProPlus && !!user.smsOptIn && !!user.phone;

  // Dispatch push + WhatsApp + SMS in parallel; failures in one channel don't block others
  const [pushResult, waResult, smsResult] = await Promise.allSettled([
    dispatchPush(user.pushSubscriptions, { title, body, link }),
    shouldWA  ? dispatchWhatsApp(user.phone!, title, body)      : Promise.resolve(false),
    shouldSms ? dispatchSms(user.phone!, title, body, link)     : Promise.resolve(false),
  ]);

  // Build a single batched status update so delivery tracking is always consistent
  // and observable — no fire-and-forget DB writes scattered across dispatchers.
  const statusUpdate: Prisma.NotificationUpdateInput = {};

  const pushSent = pushResult.status === "fulfilled" && pushResult.value;
  if (pushSent) statusUpdate.pushSent = true;

  if (shouldWA) {
    const waSent = waResult.status === "fulfilled" && waResult.value;
    if (waSent) statusUpdate.waSent = true;
    else        statusUpdate.waRetries = { increment: 1 };
  }

  if (shouldSms) {
    const smsSent = smsResult.status === "fulfilled" && smsResult.value;
    if (smsSent) statusUpdate.smsSent = true;
    else         statusUpdate.smsRetries = { increment: 1 };
  }

  if (Object.keys(statusUpdate).length > 0) {
    await db.notification.update({ where: { id: notification.id }, data: statusUpdate });
  }

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
