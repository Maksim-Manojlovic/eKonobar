/**
 * Leave request decision rules.
 *
 * Pure: no DB, no clock. Everything the decision depends on is passed in, so
 * every branch is testable and the route stays a thin shell around it.
 *
 * The premise is "everything is free unless the venue said otherwise", so the
 * default path approves without a human. Three distinct outcomes, and the
 * difference between the last two matters:
 *
 *   APPROVED — cleared every check
 *   PENDING  — a human should look (capacity is tight, notice is short, or the
 *              venue turned auto-approval off). Still very likely to be granted.
 *   REJECTED — the venue has already said no to this (day is blocked, or the
 *              balance simply is not there). Asking a manager cannot change it.
 */
import type { LeaveType } from "@prisma/client";
import type { ResolvedPolicy } from "./policy";
import { hasCapacity, isFullyBlocked } from "./policy";

export type PendingReason =
  | "CAPACITY_FULL"
  | "SHORT_NOTICE"
  | "MANUAL_APPROVAL"
  | "SICK_NEEDS_CONFIRMATION";

export type RejectCode =
  | "DAY_BLOCKED"
  | "INSUFFICIENT_BALANCE";

export type LeaveDecision =
  | { outcome: "APPROVED" }
  | { outcome: "PENDING";  reason: PendingReason }
  | { outcome: "REJECTED"; code: RejectCode; message: string };

export type DecisionInput = {
  type: LeaveType;
  policy: ResolvedPolicy;
  /** Days the request consumes; only meaningful for ANNUAL. */
  days: number;
  /** Every date in the request, "YYYY-MM-DD". */
  dates: string[];
  /** date → maxOff, for dates that have a blackout row. */
  blackouts: Map<string, number>;
  /** date → how many people are already off (APPROVED + PENDING). */
  offCounts: Map<string, number>;
  /** entitled + carriedIn − used − pending, for the relevant year. */
  balanceRemaining: number;
  /** Whole days between today and the start date; negative when retroactive. */
  noticeDays: number;
  /** True when a manager filed this on someone else's behalf. */
  filedByManager: boolean;
};

/** Leave that does not draw down the annual entitlement. */
export function deductsFromBalance(type: LeaveType): boolean {
  return type === "ANNUAL";
}

/**
 * Sick leave ignores blackout days and capacity caps.
 *
 * Under Serbian labour law bolovanje is a separate entitlement with its own
 * accrual, and more practically: a sick person cannot be ordered in because the
 * rota is full. Every other type competes for the same capacity.
 */
export function bypassesCapacity(type: LeaveType): boolean {
  return type === "SICK";
}

export function decideLeaveRequest(input: DecisionInput): LeaveDecision {
  const { type, policy, days, dates, blackouts, offCounts, balanceRemaining, noticeDays, filedByManager } = input;

  if (type === "SICK") {
    // A manager filing it is the confirmation. A worker filing their own needs
    // one — the doznaka gets checked by a human, not by this function.
    return filedByManager
      ? { outcome: "APPROVED" }
      : { outcome: "PENDING", reason: "SICK_NEEDS_CONFIRMATION" };
  }

  // A fully blocked day is the venue having already answered. No amount of
  // manager attention changes it, so this is a rejection rather than a queue.
  const blockedDay = dates.find(d => isFullyBlocked(policy, blackoutRow(blackouts, d)));
  if (blockedDay) {
    return {
      outcome: "REJECTED",
      code: "DAY_BLOCKED",
      message: `${blockedDay} je zatvoren za odmore`,
    };
  }

  if (deductsFromBalance(type) && days > balanceRemaining) {
    return {
      outcome: "REJECTED",
      code: "INSUFFICIENT_BALANCE",
      message: `Nemate dovoljno dana (traženo ${days}, preostalo ${balanceRemaining})`,
    };
  }

  if (!bypassesCapacity(type)) {
    // Pending requests count toward the cap. Without that, two requests for the
    // last slot could both be approved.
    const fullDay = dates.find(
      d => !hasCapacity(policy, blackoutRow(blackouts, d), offCounts.get(d) ?? 0),
    );
    if (fullDay) return { outcome: "PENDING", reason: "CAPACITY_FULL" };
  }

  if (noticeDays < policy.minNoticeDays) {
    return { outcome: "PENDING", reason: "SHORT_NOTICE" };
  }

  if (!policy.autoApprove) {
    return { outcome: "PENDING", reason: "MANUAL_APPROVAL" };
  }

  return { outcome: "APPROVED" };
}

/** Blackout lookup shaped for the policy helpers; null when the day has no row. */
function blackoutRow(blackouts: Map<string, number>, date: string): { maxOff: number } | null {
  const maxOff = blackouts.get(date);
  return maxOff === undefined ? null : { maxOff };
}

/** Serbian explanation of why a request is waiting, for the worker's UI. */
export const PENDING_REASON_LABELS: Record<PendingReason, string> = {
  CAPACITY_FULL:           "Već je popunjen broj slobodnih za taj dan",
  SHORT_NOTICE:            "Prijavljeno kasnije nego što pravilnik traži",
  MANUAL_APPROVAL:         "Lokal ručno odobrava sve zahteve",
  SICK_NEEDS_CONFIRMATION: "Čeka potvrdu doznake",
};
