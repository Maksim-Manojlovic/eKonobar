import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// ── Public API routes ─────────────────────────────────────────────────────────
// These routes require NO session token. All other /api/* routes are guarded at
// the middleware level (401 JSON) as a second line of defense behind withRole/withAuth.
//
// Keep this list in sync with any new genuinely-public route handlers.
const PUBLIC_API_PATTERNS: RegExp[] = [
  /^\/api\/auth\//,                                        // NextAuth + forgot/register/reset
  /^\/api\/cron\//,                                        // Bearer-token cron jobs (no user session)
  /^\/api\/reviews\/guest$/,                               // POST guest review (unauthenticated)
  /^\/api\/reviews$/,                                      // GET published reviews (public feed)
  /^\/api\/venues\/[^/]+\/public$/,                        // GET venue public info
  /^\/api\/venues\/[^/]+$/,                                // GET single venue (public marketplace)
  /^\/api\/venues\/geojson$/,                              // GET venue map GeoJSON
  /^\/api\/jobs\/geojson$/,                                // GET jobs map GeoJSON
  /^\/api\/passport\/public\//,                            // GET share-link passport
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PATTERNS.some((p) => p.test(pathname));
}

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // ── Correlation ID ────────────────────────────────────────────────────────
    // Stamp an immutable trace_id on every inbound request (honour an upstream
    // x-request-id if a proxy already set one). Forwarded to the Node handler via
    // request headers so the auth wrappers can open an AsyncLocalStorage scope,
    // and echoed on the response so clients/log aggregators can correlate.
    const traceId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-request-id", traceId);
    const withTrace = (res: NextResponse): NextResponse => {
      res.headers.set("x-request-id", traceId);
      return res;
    };
    const passThrough = () =>
      withTrace(NextResponse.next({ request: { headers: requestHeaders } }));

    // ── API routes ──────────────────────────────────────────────────────────
    // Public routes pass through; all others return 401 JSON when no session.
    // Individual route handlers still enforce withRole/withAuth as the primary
    // guard — this middleware is a defense-in-depth catch for forgotten wrappers.
    if (pathname.startsWith("/api/")) {
      if (!isPublicApiRoute(pathname) && !token) {
        return withTrace(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
      }
      return passThrough();
    }

    // ── Page routes ─────────────────────────────────────────────────────────
    // Admin routes — only ADMIN role
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return withTrace(NextResponse.redirect(new URL("/login", req.url)));
    }

    // Venue dashboard — only VENUE_OWNER
    if (
      pathname.startsWith("/venue") &&
      token?.role !== "VENUE_OWNER" &&
      token?.role !== "ADMIN"
    ) {
      return withTrace(NextResponse.redirect(new URL("/login", req.url)));
    }

    // Headhunter dashboard — only HEADHUNTER
    if (
      pathname.startsWith("/headhunter") &&
      token?.role !== "HEADHUNTER" &&
      token?.role !== "ADMIN"
    ) {
      return withTrace(NextResponse.redirect(new URL("/login", req.url)));
    }

    return passThrough();
  },
  {
    callbacks: {
      // For /api/* routes, always return true so the middleware function runs
      // and can issue a proper 401 JSON (withAuth would redirect to /login otherwise).
      // For page routes, require a token — withAuth handles the /login redirect.
      authorized: ({ req, token }) => {
        if (req.nextUrl.pathname.startsWith("/api/")) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    // Page routes (existing)
    "/waiter/:path*",
    "/venue/:path*",
    "/headhunter/:path*",
    "/admin/:path*",
    // API routes — all paths; public ones are exempted inside the middleware function
    "/api/:path*",
  ],
};
