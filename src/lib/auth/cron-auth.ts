import { NextRequest } from "next/server";

/**
 * Shared cron route authorization.
 *
 * All cron endpoints must call this — never define a local isAuthorized().
 * Returns true when the request carries `Authorization: Bearer <CRON_SECRET>`.
 * Returns false (not throws) when CRON_SECRET is unset — safe in dev but will
 * reject all requests, so set the env var in production.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
