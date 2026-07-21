/**
 * Leave balance bookkeeping.
 *
 * Every function takes a Prisma client or transaction client, so balance
 * mutations compose into the same transaction as the request they belong to.
 * That is load-bearing: the `pendingDays` reservation and the capacity re-check
 * must be atomic with the request row, or two concurrent requests can both take
 * the last remaining day.
 */
import type { LeaveBalance } from "@prisma/client";
import type { db } from "@/lib/core/db";
import type { ResolvedPolicy } from "./policy";
import { proRatedEntitlement } from "./policy";

/**
 * Accepts the extended client or its transaction client.
 *
 * Derived from `typeof db` rather than written as `Prisma.TransactionClient`:
 * `db` is `$extends`-ed with the soft-delete filter, and an extended client's
 * transaction callback receives a differently-typed argument that the plain
 * `Prisma.TransactionClient` does not match.
 */
type ExtendedClient   = typeof db;
type ExtendedTxClient = Parameters<Parameters<ExtendedClient["$transaction"]>[0]>[0];
export type Db = ExtendedClient | ExtendedTxClient;

/** entitled + carried in − used − reserved. What the worker may still book. */
export function remainingDays(balance: Pick<LeaveBalance,
  "entitledDays" | "carriedInDays" | "usedDays" | "pendingDays">): number {
  return balance.entitledDays + balance.carriedInDays - balance.usedDays - balance.pendingDays;
}

/**
 * Fetch the balance row for a staff member's leave year, creating it on first
 * use so nobody has to be "enrolled" before requesting leave.
 *
 * Entitlement is recomputed on every call and written back when it differs, so
 * raising `annualDays` in the policy reaches people who already have a row.
 * Days already used or reserved are never touched by this — only the ceiling
 * moves.
 */
export async function ensureBalance(
  db: Db,
  staffId: string,
  year: number,
  policy: ResolvedPolicy,
  startedAt: Date,
): Promise<LeaveBalance> {
  const entitled = proRatedEntitlement(policy.annualDays, startedAt, year);

  const existing = await db.leaveBalance.findUnique({
    where: { staffId_year: { staffId, year } },
  });

  if (!existing) {
    return db.leaveBalance.create({
      data: { staffId, year, entitledDays: entitled },
    });
  }

  if (existing.entitledDays !== entitled) {
    return db.leaveBalance.update({
      where: { id: existing.id },
      data: { entitledDays: entitled },
    });
  }

  return existing;
}

/**
 * Reserve days against a pending request.
 *
 * Reserving at request time — rather than at approval time — is what stops two
 * people booking the same last day while both sit in the queue.
 */
export function reservePending(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: { pendingDays: { increment: days } },
  });
}

/** Release a reservation without spending it (rejection or cancellation). */
export function releasePending(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: { pendingDays: { decrement: days } },
  });
}

/** Move a reservation into actually-used days (approval of a pending request). */
export function commitPending(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: {
      pendingDays: { decrement: days },
      usedDays:    { increment: days },
    },
  });
}

/** Spend days directly, for a request approved without ever being pending. */
export function commitDirect(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: { usedDays: { increment: days } },
  });
}

/** Give back days from a request that was approved and is now cancelled. */
export function refundUsed(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: { usedDays: { decrement: days } },
  });
}

/** Sick days are recorded but never deducted from the annual entitlement. */
export function recordSickDays(db: Db, balanceId: string, days: number) {
  return db.leaveBalance.update({
    where: { id: balanceId },
    data: { sickDaysTaken: { increment: days } },
  });
}

/**
 * How many people are already off on each date in a window, counting APPROVED
 * and PENDING requests.
 *
 * Pending counts toward the cap deliberately: without it, two requests for the
 * last slot would each see capacity and both be approved.
 */
export async function countOffPerDate(
  db: Db,
  venueId: string,
  department: "FOH" | "BOH",
  from: Date,
  to: Date,
  excludeRequestId?: string,
): Promise<Map<string, number>> {
  const overlapping = await db.leaveRequest.findMany({
    where: {
      venueId,
      department,
      status: { in: ["APPROVED", "PENDING"] },
      // Overlap, not containment: a request starting before the window can still
      // cover days inside it.
      startDate: { lte: to },
      endDate:   { gte: from },
      ...(excludeRequestId && { id: { not: excludeRequestId } }),
    },
    select: { startDate: true, endDate: true },
  });

  const counts = new Map<string, number>();
  for (const r of overlapping) {
    // Clamp to the window so days outside it are not tallied.
    const start = r.startDate < from ? from : r.startDate;
    const end   = r.endDate   > to   ? to   : r.endDate;
    for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
      const key = new Date(t).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
