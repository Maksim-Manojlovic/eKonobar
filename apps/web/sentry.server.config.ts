import * as Sentry from "@sentry/nextjs";
import { PrismaInstrumentation } from "@prisma/instrumentation";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture/profile 10% of transactions in prod; keep slow/errored ones at 100%
  // via tracesSampler so the interesting transactions are never sampled away.
  tracesSampler: (ctx) => {
    if (ctx.parentSampled !== undefined) return ctx.parentSampled;
    return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
  },
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  integrations: [
    // Emit a span per Prisma query (requires previewFeatures=["tracing"] in
    // schema.prisma) so DB latency is distinguishable from network / cold start.
    Sentry.prismaIntegration({ prismaInstrumentation: new PrismaInstrumentation() }),
  ],
});
