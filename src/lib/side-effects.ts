import { syncVenueTrustScore, syncPassportScore } from "@/lib/sync-scores";
import { notify } from "@/lib/notify";
import { NotificationType } from "@prisma/client";

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

  if (opts.syncVenueId)  tasks.push(syncVenueTrustScore(opts.syncVenueId));
  if (opts.syncWaiterId) tasks.push(syncPassportScore(opts.syncWaiterId));

  for (const n of opts.notifications ?? []) {
    tasks.push(notify(n.userId, n.type, n.title, n.body, n.link));
  }

  if (tasks.length === 0) return;

  Promise.allSettled(tasks).then(results => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[side-effects] fire-and-forget failed", r.reason);
      }
    }
  });
}
