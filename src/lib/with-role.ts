import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { Role } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteCtx = { params: Promise<any> };

type AuthedHandler<C extends RouteCtx = RouteCtx> = (
  req: Request,
  ctx: C,
  session: Session,
) => Promise<Response>;

/**
 * Wraps a route handler with session auth + role enforcement.
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
  return async (req: Request, ctx: C): Promise<Response> => {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, ctx, session);
  };
}

/**
 * Same as withRole but accepts any authenticated user regardless of role.
 * Use for endpoints that require login but are not role-specific.
 */
export function withAuth<C extends RouteCtx = RouteCtx>(handler: AuthedHandler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(req, ctx, session);
  };
}
