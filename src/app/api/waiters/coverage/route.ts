import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";
import logger from "@/lib/core/logger";
import { BELGRADE_MUNICIPALITIES } from "@/lib/geo/municipalities";

/**
 * Waiter reach coverage per Belgrade opština — how many available waiters have
 * declared they will work in each. Owners/headhunters use it to see where the
 * talent is before searching. Aggregate counts only: no names, no coordinates.
 *
 * A waiter with two municipalities in reach counts toward both — this measures
 * "how many will come here", not a partition of the waiter pool.
 */

const CACHE_KEY = "coverage:waiters:reach";
const CACHE_TTL = 300; // seconds

export interface CoverageCell {
  municipality: string;
  availableCount: number;
}

async function computeCoverage(): Promise<CoverageCell[]> {
  // One query: pull the reach arrays of every available waiter, tally in-process.
  // Prisma can't GROUP BY an array element, and the available-waiter set is small
  // enough that a single fetch + tally beats 17 parallel counts.
  const rows = await db.user.findMany({
    where: {
      role: "WAITER",
      deletedAt: null,
      waiterPassport: { currentlyAvailable: true },
    },
    select: { waiterPassport: { select: { workMunicipalities: true } } },
  });

  const counts = new Map<string, number>(BELGRADE_MUNICIPALITIES.map((m) => [m, 0]));
  for (const r of rows) {
    for (const m of r.waiterPassport?.workMunicipalities ?? []) {
      // Guard against any legacy non-canonical value slipping past the count map.
      if (counts.has(m)) counts.set(m, counts.get(m)! + 1);
    }
  }

  // Canonical order preserved so the client can render a stable ladder.
  return BELGRADE_MUNICIPALITIES.map((m) => ({ municipality: m, availableCount: counts.get(m)! }));
}

export const GET = withRole(["VENUE_OWNER", "HEADHUNTER"], async () => {
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return NextResponse.json(JSON.parse(cached));
    } catch {
      // Redis error — fall through to a direct DB compute.
    }
  }

  const coverage = await computeCoverage();

  if (redis) {
    redis
      .set(CACHE_KEY, JSON.stringify(coverage), "EX", CACHE_TTL)
      .catch((err) => logger.warn({ err }, "waiter coverage: redis cache write failed"));
  }

  return NextResponse.json(coverage);
});
