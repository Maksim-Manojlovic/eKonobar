/**
 * Client IP extraction — two variants for different request types.
 *
 * Trust strategy (controlled by env var):
 *   TRUST_PROXY=1  → trust the leftmost X-Forwarded-For entry. Set this ONLY when
 *                    the app is behind a proxy/LB that writes XFF correctly (Vercel,
 *                    Railway, fly.io, nginx with proxy_set_header). Without it, XFF
 *                    is fully attacker-controlled and MUST NOT be used for rate limiting.
 *   default        → use req.ip (Next.js edge / Vercel runtime), fall back to "unknown".
 *
 * When no reliable IP is available the function returns "unknown", which collapses all
 * unidentified traffic into one rate-limit bucket — conservative but safe.
 */

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

/**
 * For Next.js route handlers (NextRequest or standard Request).
 * NextRequest exposes `.ip` on Vercel / edge runtimes.
 */
export function getClientIp(req: Request): string {
  if (TRUST_PROXY) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }
  const ip = (req as { ip?: string }).ip;
  if (ip) return ip;
  return "unknown";
}

/**
 * For NextAuth `authorize()` callback where `req.headers` is a plain object,
 * not a `Headers` instance.
 */
export function getClientIpFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): string {
  if (TRUST_PROXY && headers) {
    const raw = headers["x-forwarded-for"];
    const xff = Array.isArray(raw) ? raw[0] : raw;
    if (xff) return xff.split(",")[0].trim();
  }
  return "unknown";
}
