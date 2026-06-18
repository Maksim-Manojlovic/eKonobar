import { getServerSession, type Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/config";
import logger from "@/lib/core/logger";
import { REQUEST_ID_HEADER, runWithRequestContext } from "@/lib/core/request-context";
import type { Role } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteCtx = { params: Promise<any> };

/**
 * Opens an AsyncLocalStorage request scope around the handler so the pino logger
 * stamps traceId/userId/route on every line. traceId is the x-request-id the
 * middleware set (falls back to a fresh UUID if the wrapper runs without it,
 * e.g. in unit tests). Echoes the traceId on the response header.
 */
function runScoped(
  req: NextRequest,
  session: Session | null,
  run: () => Promise<Response>,
): Promise<Response> {
  const traceId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  const route = req.nextUrl?.pathname ?? req.url;
  return runWithRequestContext(
    { traceId, userId: session?.user?.id, route, method: req.method },
    async () => {
      const res = await run();
      res.headers.set(REQUEST_ID_HEADER, traceId);
      return res;
    },
  );
}

type AuthedHandler<C extends RouteCtx = RouteCtx> = (
  req: NextRequest,
  ctx: C,
  session: Session,
) => Promise<Response>;

type OptionalAuthHandler<C extends RouteCtx = RouteCtx> = (
  req: NextRequest,
  ctx: C,
  session: Session | null,
) => Promise<Response>;

/**
 * Wraps a route handler with session auth + role enforcement.
 * Returns 401 when no session, 403 when wrong role.
 * The handler receives the typed Session — no need to call getServerSession again.
 *
 * Usage:
 *   export const GET = withRole("ADMIN", async (req, ctx, session) => { ... });
 *   export const POST = withRole(["VENUE_OWNER", "ADMIN"], async (req, ctx, session) => { ... });
 */
export function withRole<C extends RouteCtx = RouteCtx>(
  roles: Role | Role[],
  handler: AuthedHandler<C>,
) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const session = await getServerSession(authOptions);

    return runScoped(req, session, async () => {
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const allowed = Array.isArray(roles) ? roles : [roles];
      if (!allowed.includes(session.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      try {
        return await handler(req, ctx, session);
      } catch (err) {
        logger.error({ err }, `${req.method} ${req.nextUrl?.pathname ?? req.url}`);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    });
  };
}

/**
 * Same as withRole but accepts any authenticated user regardless of role.
 * Use for endpoints that require login but are not role-specific.
 */
export function withAuth<C extends RouteCtx = RouteCtx>(handler: AuthedHandler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const session = await getServerSession(authOptions);

    return runScoped(req, session, async () => {
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        return await handler(req, ctx, session);
      } catch (err) {
        logger.error({ err }, `${req.method} ${req.nextUrl?.pathname ?? req.url}`);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    });
  };
}

/**
 * Like withAuth but session is optional — passes null when unauthenticated.
 * Use for public endpoints that enrich their response for logged-in users
 * (e.g. GET /api/jobs adds application status for WAITERs).
 */
export function withOptionalAuth<C extends RouteCtx = RouteCtx>(handler: OptionalAuthHandler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const session = await getServerSession(authOptions);
    return runScoped(req, session, async () => {
      try {
        return await handler(req, ctx, session ?? null);
      } catch (err) {
        logger.error({ err }, `${req.method} ${req.nextUrl?.pathname ?? req.url}`);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    });
  };
}
