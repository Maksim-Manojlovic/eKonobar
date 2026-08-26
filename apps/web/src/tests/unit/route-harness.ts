import { vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

/**
 * Shared harness for route-handler unit tests.
 *
 * Before this existed, `makeReq` was redefined in 61 test files, `mockSession` in
 * 59, `CTX` in 40 and `mockNoSession` in 37 — roughly 226 hand-maintained copies
 * of five functions across 126 test files. That froze the `NextRequest`
 * construction contract into every one of them (a Next.js upgrade became a
 * 61-file migration) and let the session-mock shape drift file by file.
 *
 * The caller still owns its `vi.mock(...)` calls — those must stay at module
 * scope in the test file itself, because Vitest hoists them. This module only
 * removes the boilerplate that follows.
 *
 * Usage:
 *   vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
 *   vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
 *   import { getReq, postReq, CTX, ctxWith, mockSession, mockNoSession }
 *     from "@/tests/unit/route-harness";
 */

const DEFAULT_URL = "http://localhost/api/test";

/** GET request. Pass a full URL when the handler reads query params. */
export function getReq(url: string = DEFAULT_URL): NextRequest {
  return new NextRequest(url);
}

/** Request with a JSON body. Defaults to POST. */
export function jsonReq(
  body: unknown,
  { method = "POST", url = DEFAULT_URL, headers = {} }: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export const postReq  = (body: unknown, url?: string) => jsonReq(body, { method: "POST",  url });
export const patchReq = (body: unknown, url?: string) => jsonReq(body, { method: "PATCH", url });
export const putReq   = (body: unknown, url?: string) => jsonReq(body, { method: "PUT",   url });

/**
 * Route handlers are typed `(req, ctx)` — always pass a second argument.
 * `CTX` for non-dynamic routes, `ctxWith({ id })` for `[id]` routes.
 */
export const CTX = { params: Promise.resolve({}) };

export const ctxWith = <P extends Record<string, string>>(params: P) => ({
  params: Promise.resolve(params),
});

/**
 * `as never` mirrors what all 59 copies did: the real Session type carries more
 * fields than any handler reads, and widening it here would force every caller
 * to build a full session object.
 */
export function mockSession(role: string, id = "user-1"): void {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

export function mockNoSession(): void {
  vi.mocked(getServerSession).mockResolvedValue(null);
}
