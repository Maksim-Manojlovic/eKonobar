/**
 * Shared business constants for subscription lifecycle and job visibility.
 *
 * Single source of truth — import from here instead of inlining magic numbers.
 * Changing subscription duration or Red Alert delay requires one edit.
 */

/** Passport PRO / PRO_PLUS subscription period (30 days in ms). */
export const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Delay before FREE-tier waiters see Red Alert job posts (30 min in ms). */
export const RED_ALERT_DELAY_MS = 30 * 60 * 1000;
