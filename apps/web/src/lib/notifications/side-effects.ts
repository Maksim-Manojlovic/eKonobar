import { syncVenueTrustScore, syncPassportScore } from "@/lib/scoring/sync";
import { notify } from "@/lib/notifications/notify";
import { redis } from "@/lib/core/redis";
import { NotificationType } from "@prisma/client";
import logger from "@/lib/core/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotifyOpts {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export interface SideEffectOpts {
  syncVenueId?:   string | null;
  syncWaiterId?:  string | null;
  notifications?: NotifyOpts[];
}

// ── Score sync helpers ────────────────────────────────────────────────────────

const SCORE_SYNC_COOLDOWN_S = 5;

/**
 * Runs syncFn unless a sync for this key fired within the last 5 seconds.
 * Prevents redundant parallel recalculations when concurrent requests mutate
 * the same subject (e.g. 10 simultaneous clock-ins for the same waiter).
 * Falls through to syncFn directly when Redis is unavailable.
 */
async function guardedSync(key: string, syncFn: () => Promise<void>): Promise<void> {
  if (redis) {
    const acquired = await redis.set(key, "1", "EX", SCORE_SYNC_COOLDOWN_S, "NX");
    if (!acquired) return;
  }
  await syncFn();
}

// ── fireSideEffects ───────────────────────────────────────────────────────────

/**
 * Schedules fire-and-forget side effects after a successful write.
 * Returns void — never awaited by request handlers.
 *
 * All failures are caught and logged; they never bubble back to the caller.
 * Tests mock this function as vi.fn() — a synchronous no-op — so no
 * `await new Promise(r => setTimeout(r, 0))` timer hacks are needed.
 */
export function fireSideEffects(opts: SideEffectOpts): void {
  const tasks: Promise<unknown>[] = [];

  if (opts.syncVenueId) {
    tasks.push(guardedSync(
      `score:sync:venue:${opts.syncVenueId}`,
      () => syncVenueTrustScore(opts.syncVenueId!),
    ));
  }
  if (opts.syncWaiterId) {
    tasks.push(guardedSync(
      `score:sync:waiter:${opts.syncWaiterId}`,
      () => syncPassportScore(opts.syncWaiterId!),
    ));
  }

  for (const n of opts.notifications ?? []) {
    tasks.push(notify(n.userId, n.type, n.title, n.body, n.link));
  }

  if (tasks.length === 0) return;

  Promise.allSettled(tasks).then(results => {
    for (const r of results) {
      if (r.status === "rejected") {
        logger.error({ err: r.reason }, "[side-effects] fire-and-forget failed");
      }
    }
  });
}
