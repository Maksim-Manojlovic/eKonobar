import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { notify } from "@/lib/notifications/notify";

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
 * This matching only works when the venue's municipality is canonical
 * (`normalizeMunicipality` on write + the backfill script) — a free-text venue
 * municipality will not `has`-match a canonical `workMunicipalities` entry.
 *
 * Fire-and-forget: call without await from the route and log on rejection. The
 * DB query must not block the POST response.
 *
 * Returns the number of waiters actually notified (for logging / tests).
 */
export async function broadcastRedAlert(b: RedAlertBroadcast): Promise<number> {
  const recipients = await db.user.findMany({
    where: {
      role: "WAITER",
      deletedAt: null,
      waiterPassport: {
        currentlyAvailable: true,
        workMunicipalities: { has: b.municipality },
      },
    },
    select: { id: true },
    take: MAX_RECIPIENTS,
  });

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
