import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context carried via AsyncLocalStorage on the Node runtime.
 *
 * `src/middleware.ts` (edge runtime — no ALS) stamps an immutable `x-request-id`
 * header on every inbound request. The Node-side auth wrappers (`withRole` /
 * `withAuth` / `withOptionalAuth`) read that header and open an ALS scope so the
 * pino logger (`lib/core/logger.ts` mixin) can stamp `traceId` / `userId` / `route`
 * onto every log line without per-call-site plumbing. Sentry runs its own trace
 * propagation alongside this — `traceId` here joins our JSON logs to that trace.
 */
export interface RequestContext {
  traceId: string;
  userId?: string;
  route: string;
  method: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = storage;

/** Current request context, or undefined outside a request scope. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Header name used to propagate the correlation ID across the edge→node boundary. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Run `fn` inside a fresh request context scope. */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
