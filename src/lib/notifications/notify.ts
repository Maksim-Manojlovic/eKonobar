import { NotificationType, Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";
import logger from "@/lib/core/logger";
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

// ── User dispatch prefs cache ─────────────────────────────────────────────────
//
// Caches the full user payload needed for notify() dispatch decisions — role,
// contact info, push subscriptions, and passport tier — to avoid a multi-join
// DB read on every notification send.
//
// Push subscriptions are included in the cache. Stale endpoints (browser cleared
// or expired) are auto-cleaned by dispatchPush when it receives a 410 response.
//
// Busted by: notification-prefs PATCH, push subscribe/unsubscribe, tier changes.

const DISPATCH_PREFS_TTL = 300; // seconds

type DispatchUser = Awaited<ReturnType<typeof fetchDispatchUser>>;

async function fetchDispatchUser(userId: string) {
  return db.user.findUnique({
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
}

async function getCachedDispatchUser(userId: string): Promise<DispatchUser> {
  const key = `notif:dispatch:prefs:${userId}`;

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        // Reconstruct the Date field that JSON serialization turns into a string.
        if (parsed?.waiterPassport?.subscriptionExpiresAt) {
          parsed.waiterPassport.subscriptionExpiresAt =
            new Date(parsed.waiterPassport.subscriptionExpiresAt);
        }
        return parsed as DispatchUser;
      }
    } catch {
      // Redis error — fall through to DB.
    }
  }

  const user = await fetchDispatchUser(userId);

  if (user && redis) {
    redis
      .set(key, JSON.stringify(user), "EX", DISPATCH_PREFS_TTL)
      .catch((err) => logger.warn({ err, userId }, "notify: dispatch-prefs cache write failed"));
  }

  return user;
}

/** Call after any change to a user's notification-relevant fields. */
export function bustNotifyPrefsCache(userId: string): void {
  if (!redis) return;
  redis
    .del(`notif:dispatch:prefs:${userId}`)
    .catch((err) => logger.warn({ err, userId }, "notify: dispatch-prefs cache bust failed"));
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
  const user = await getCachedDispatchUser(userId);

  // db already filters deletedAt; null means soft-deleted or missing
  if (!user) return;

  const notification = await db.notification.create({
    data: { userId, type, title, body, link: link ?? null },
  });

  // Bust the notification list cache so the next poll reflects the new item.
  if (redis) {
    redis
      .del(`notif:cache:${userId}`)
      .catch((err) => logger.warn({ err, userId }, "notify: notif-list cache bust failed"));
  }

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
    // Last-resort channel — if this also fails the user gets nothing, so surface it.
    sendNotificationEmail({ toEmail: user.email, title, body, link }).catch((err) =>
      logger.warn({ err, userId, type }, "notify: email fallback send failed"),
    );
  }
}
