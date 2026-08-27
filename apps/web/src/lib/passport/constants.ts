/**
 * Shared business constants for job visibility.
 *
 * Single source of truth — import from here instead of inlining magic numbers.
 */

/** Delay before anonymous (signed-out) callers see Red Alert job posts (30 min in ms). */
export const RED_ALERT_DELAY_MS = 30 * 60 * 1000;
