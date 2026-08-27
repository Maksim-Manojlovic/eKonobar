/**
 * Leave-year rollover.
 *
 * Two distinct jobs, both driven by the same cron:
 *
 *   1. Carry unused days into the new year, capped by policy.
 *   2. Expire carried-in days that were not used by the policy deadline.
 *
 * Serbian practice is that leftover days must be taken by roughly mid-year
 * (`carryOverDeadline`, default 06-30) or they are lost. Both steps are
 * idempotent so a re-run — or a cron that fires twice — cannot double-credit or
 * double-expire.
 */
import type { StaffDepartment } from "@prisma/client";
import { db } from "@/lib/core/db";
import { resolvePolicy, proRatedEntitlement, type ResolvedPolicy } from "./policy";
import { remainingDays } from "./balance";

/**
 * Whether `today` is on or past the policy's MM-DD deadline for `year`.
 * A malformed deadline never expires anything — losing someone's leave to a
 * typo is worse than carrying it a bit too long.
 */
export function isPastDeadline(deadline: string, today: Date): boolean {
  const match = /^(\d{2})-(\d{2})$/.exec(deadline);
  if (!match) return false;

  const month = Number(match[1]);
  const day   = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day));
  return today >= cutoff;
}

/**
 * How many days roll into the next year: whatever is left, capped by the
 * policy's `carryOverDays`, and nothing at all when carry-over is off.
 * Never negative — an over-spent balance carries zero, not a debt.
 */
export function carryOverAmount(
  policy: ResolvedPolicy,
  balance: { entitledDays: number; carriedInDays: number; usedDays: number; pendingDays: number },
): number {
  if (!policy.allowCarryOver) return 0;
  const left = remainingDays(balance);
  if (left <= 0) return 0;
  return Math.min(left, policy.carryOverDays);
}

export type RolloverResult = {
  year: number;
  balancesCreated: number;
  daysCarried: number;
  balancesExpired: number;
  daysExpired: number;
};

/**
 * Open the new leave year for every active staff member and expire stale
 * carry-over from the year just closed.
 *
 * `now` is injectable so the behaviour is testable without touching the clock.
 */
export async function runLeaveRollover(now = new Date()): Promise<RolloverResult> {
  const year     = now.getUTCFullYear();
  const lastYear = year - 1;

  const staff = await db.venueStaff.findMany({
    where: { status: { not: "ENDED" } },
    select: { id: true, venueId: true, department: true, startedAt: true },
  });

  const policies = await db.leavePolicy.findMany();
  const policyFor = (venueId: string, department: StaffDepartment) =>
    resolvePolicy(policies.find(p => p.venueId === venueId && p.department === department));

  const result: RolloverResult = {
    year, balancesCreated: 0, daysCarried: 0, balancesExpired: 0, daysExpired: 0,
  };
  if (staff.length === 0) return result;

  const staffIds = staff.map(s => s.id);
  const balances = await db.leaveBalance.findMany({
    where: { staffId: { in: staffIds }, year: { in: [lastYear, year] } },
  });

  for (const member of staff) {
    const policy = policyFor(member.venueId, member.department);
    const prev   = balances.find(b => b.staffId === member.id && b.year === lastYear);
    const curr   = balances.find(b => b.staffId === member.id && b.year === year);

    // ── 1. Open the new year ────────────────────────────────────────────────
    if (!curr) {
      const carried = prev ? carryOverAmount(policy, prev) : 0;
      await db.leaveBalance.create({
        data: {
          staffId: member.id,
          year,
          entitledDays:  proRatedEntitlement(policy.annualDays, member.startedAt, year),
          carriedInDays: carried,
        },
      });
      result.balancesCreated++;
      result.daysCarried += carried;
    }

    // ── 2. Expire unused carry-over past the deadline ───────────────────────
    const target = curr ?? await db.leaveBalance.findUnique({
      where: { staffId_year: { staffId: member.id, year } },
    });
    if (!target || target.carriedInDays <= 0) continue;
    if (!isPastDeadline(policy.carryOverDeadline, now)) continue;

    // Carried days are spent first, so what survives the deadline is whatever
    // of them the worker did not get to. Anything already used or reserved
    // stays theirs.
    const spent    = target.usedDays + target.pendingDays;
    const unusedCarry = Math.max(0, target.carriedInDays - spent);
    if (unusedCarry <= 0) continue;

    await db.leaveBalance.update({
      where: { id: target.id },
      data: { carriedInDays: { decrement: unusedCarry } },
    });
    result.balancesExpired++;
    result.daysExpired += unusedCarry;
  }

  return result;
}
