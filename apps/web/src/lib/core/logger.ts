import pino from "pino";
import { getRequestContext } from "@/lib/core/request-context";

const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  // Inject the active request context (set by withRole/withAuth) into every log
  // line — traceId joins each JSON record to its Sentry trace, userId/route/method
  // give "who did what" without per-call-site plumbing. Empty outside a request.
  mixin() {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return { traceId: ctx.traceId, userId: ctx.userId, route: ctx.route, method: ctx.method };
  },
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } },
  }),
});

export default logger;
