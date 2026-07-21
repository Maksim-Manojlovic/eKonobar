import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { runLeaveRollover } from "@/lib/leave/carry-over";
import logger from "@/lib/core/logger";

/**
 * Opens the new leave year and expires stale carry-over.
 *
 * Safe to run daily: opening a year is a no-op once the balance exists, and
 * expiry only fires past the policy deadline and only on days that are still
 * unused. Running it daily rather than annually also means a venue that
 * changes its deadline mid-year is honoured without a manual trigger.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLeaveRollover();
    logger.info(result, "leave rollover complete");
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "leave rollover failed");
    return NextResponse.json({ error: "Rollover failed" }, { status: 500 });
  }
}
