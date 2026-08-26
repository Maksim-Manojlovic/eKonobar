import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";
import { resolvePolicy } from "@/lib/leave/policy";
import { ensureBalance, remainingDays } from "@/lib/leave/balance";

const QuerySchema = z.object({
  year:    z.coerce.number().int().min(2000).max(2100).optional(),
  venueId: z.string().min(1).optional(),
});

/**
 * A worker's leave balance, one entry per venue they are on the roster of.
 *
 * Balances are per-venue by design: leave at one venue says nothing about
 * availability at another, so the worker UI shows a venue selector rather than
 * a single misleading total.
 */
export const GET = withAuth(async (req, _ctx, session) => {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;

  const year = parsed.data.year ?? new Date().getUTCFullYear();

  const rosters = await db.venueStaff.findMany({
    where: {
      waiterId: session.user.id,
      status: { not: "ENDED" },
      ...(parsed.data.venueId && { venueId: parsed.data.venueId }),
    },
    select: {
      id: true, venueId: true, department: true, position: true, startedAt: true,
      venue: { select: { id: true, name: true, logo: true } },
    },
  });

  if (rosters.length === 0) {
    return NextResponse.json({ year, balances: [] });
  }

  const policies = await db.leavePolicy.findMany({
    where: { venueId: { in: rosters.map(r => r.venueId) } },
  });

  const balances = [];
  for (const roster of rosters) {
    const policy = resolvePolicy(
      policies.find(p => p.venueId === roster.venueId && p.department === roster.department),
    );
    // Creates the row on first view, so a worker never sees an empty state that
    // only an admin action could fix.
    const balance = await ensureBalance(db, roster.id, year, policy, roster.startedAt);

    balances.push({
      staffId:    roster.id,
      venue:      roster.venue,
      department: roster.department,
      position:   roster.position,
      year,
      entitledDays:  balance.entitledDays,
      carriedInDays: balance.carriedInDays,
      usedDays:      balance.usedDays,
      pendingDays:   balance.pendingDays,
      sickDaysTaken: balance.sickDaysTaken,
      remainingDays: remainingDays(balance),
      policy: {
        annualDays:    policy.annualDays,
        minNoticeDays: policy.minNoticeDays,
        countWeekends: policy.countWeekends,
        autoApprove:   policy.autoApprove,
      },
    });
  }

  return NextResponse.json({ year, balances });
});
