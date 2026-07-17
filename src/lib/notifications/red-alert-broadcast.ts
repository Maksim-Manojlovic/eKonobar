import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { notify } from "@/lib/notifications/notify";
import { isPro } from "@/lib/passport/tier";

/** Max waiters pinged per Red Alert — avoids a fan-out storm on a busy opština. */
const MAX_RECIPIENTS = 50;

export interface RedAlertBroadcast {
  jobPostId:    string;
  jobTitle:     string;
  venueName:    string;
  municipality: string;
}

/**
 * Notifies waiters when a Red Alert job lands in their declared reach.
 *
 * Recipients: available WAITERs whose `workMunicipalities` includes the venue's
 * municipality — capped at MAX_RECIPIENTS.
 *
 * **Only PRO / PRO_PLUS waiters are pinged.** Red Alert early access is the paid
 * feature: FREE waiters see the post through normal browsing after the 30-minute
 * delay (enforced in GET /api/jobs). Pushing to FREE here would leak that early
 * access through the notification channel — web push reaches every tier — and
 * undo the gate the rest of the system enforces. Tier is filtered at the DB by
 * `passportTier`, then re-checked in-process so an expired subscription (stored
 * tier still PRO, effectively FREE) does not slip through.
 *
 * Fire-and-forget: call without await from the route and log on rejection. The
 * DB query must not block the POST response.
 *
 * Returns the number of waiters actually notified (for logging / tests).
 */
export async function broadcastRedAlert(b: RedAlertBroadcast): Promise<number> {
  const candidates = await db.user.findMany({
    where: {
      role: "WAITER",
      deletedAt: null,
      waiterPassport: {
        currentlyAvailable: true,
        workMunicipalities: { has: b.municipality },
        passportTier: { in: ["PRO", "PRO_PLUS"] },
      },
    },
    select: {
      id: true,
      waiterPassport: { select: { passportTier: true, subscriptionExpiresAt: true } },
    },
    // Over-fetch a little so dropping expired subscriptions still leaves a full cap.
    take: MAX_RECIPIENTS * 2,
  });

  const recipients = candidates
    .filter((u) => isPro(u.waiterPassport))
    .slice(0, MAX_RECIPIENTS);

  const title = `Red Alert u ${b.municipality}`;
  const body  = `${b.venueName} hitno traži konobara: ${b.jobTitle}`;
  const link  = `/jobs/${b.jobPostId}`;

  const results = await Promise.allSettled(
    recipients.map((u) => notify(u.id, "RED_ALERT_POSTED", title, body, link)),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn(
      { jobPostId: b.jobPostId, failed, total: recipients.length },
      "red-alert broadcast: some notifications failed",
    );
  }

  return recipients.length;
}
