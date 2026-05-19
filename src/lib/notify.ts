import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { sendPush } from "@/lib/webpush";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSms } from "@/lib/sms";

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  // Always create the DB record — this is the source of truth for in-app feed
  const notification = await db.notification.create({
    data: { userId, type, title, body, link: link ?? null },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      phone:    true,
      smsOptIn: true,
      waOptIn:  true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      waiterPassport: { select: { passportTier: true, subscriptionExpiresAt: true } },
    },
  });

  if (!user) return;

  // Resolve active passport tier (FREE if subscription lapsed)
  const tierRaw = user.waiterPassport?.passportTier ?? "FREE";
  const expiresAt = user.waiterPassport?.subscriptionExpiresAt;
  const passportTier = expiresAt && expiresAt < new Date() ? "FREE" : tierRaw;

  const isPro     = passportTier === "PRO" || passportTier === "PRO_PLUS";
  const isProPlus = passportTier === "PRO_PLUS";

  // ── Web push (free, best-effort) ──────────────────────────────────────────
  if (user.pushSubscriptions.length > 0) {
    const payload = { title, body, link };
    const results = await Promise.allSettled(
      user.pushSubscriptions.map(sub =>
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
      db.notification.update({ where: { id: notification.id }, data: { pushSent: true } }).catch(() => {});
    }
  }

  // ── WhatsApp (Passport PRO+) ──────────────────────────────────────────────
  if (isPro && user.waOptIn && user.phone) {
    sendWhatsApp(user.phone, title, body)
      .then(() =>
        db.notification.update({ where: { id: notification.id }, data: { waSent: true } }).catch(() => {}),
      )
      .catch(() => {
        // Increment retry counter — cron will retry up to 3× within 24h
        db.notification.update({
          where: { id: notification.id },
          data:  { waRetries: { increment: 1 } },
        }).catch(() => {});
      });
  }

  // ── Infobip SMS (Passport PRO_PLUS only) ──────────────────────────────────
  if (isProPlus && user.smsOptIn && user.phone) {
    const smsText = `${title}: ${body}${link ? " | ekonobar.rs" : ""}`;
    sendSms(user.phone, smsText)
      .then(() =>
        db.notification.update({ where: { id: notification.id }, data: { smsSent: true } }).catch(() => {}),
      )
      .catch(() => {
        // Increment retry counter — cron will retry up to 3× within 24h
        db.notification.update({
          where: { id: notification.id },
          data:  { smsRetries: { increment: 1 } },
        }).catch(() => {});
      });
  }
}
