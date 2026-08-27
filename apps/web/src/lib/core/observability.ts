import * as Sentry from "@sentry/nextjs";

/**
 * Wrap an external/async operation in a Sentry span so its latency is attributable
 * in distributed traces. Sentry auto-instruments route handlers and Prisma queries,
 * but NOT our outbound third-party calls (Monri, WhatsApp/Infobip, web-push) — those
 * are the "why is it slow" blind spots this helper closes.
 *
 * No-op safe: when the SDK is uninitialised (unit tests, missing DSN) Sentry.startSpan
 * still runs the callback and returns its value, so wrapping never changes behaviour.
 *
 *   const r = await withSpan(
 *     { name: "monri.createPaymentSession", op: "http.client", attributes: { order } },
 *     () => fetch(...),
 *   );
 */
export function withSpan<T>(
  opts: {
    name: string;
    op: string;
    attributes?: Record<string, string | number | boolean | undefined>;
  },
  fn: (span: Sentry.Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(opts, fn);
}
