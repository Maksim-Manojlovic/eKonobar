import logger from "@/lib/core/logger";

const isProd = process.env.NODE_ENV === "production";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[env] Missing required environment variable: ${name}`);
  return v;
}

function warnIfMissing(...names: string[]): void {
  if (!isProd) return;
  for (const name of names) {
    if (!process.env[name]) {
      logger.warn(`[env] ${name} is not set — related feature will be disabled`);
    }
  }
}

// ── Required — app is broken without these ────────────────────────────────
required("DATABASE_URL");
required("NEXTAUTH_SECRET");
required("NEXT_PUBLIC_APP_URL");

// ── Optional features — warn in production when missing ───────────────────
warnIfMissing(
  "REDIS_URL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "MONRI_MERCHANT_KEY",
  "MONRI_AUTHENTICITY_TOKEN",
  "CRON_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "NEXT_PUBLIC_VAPID_KEY",
);

// ── Telemetry guard ───────────────────────────────────────────────────────
// Sentry no-ops silently when its DSN is unset (Sentry.init with dsn=undefined),
// which would leave production with zero error/trace capture and no obvious
// signal. Flag it loudly in prod — non-fatal, since telemetry is optional infra.
if (isProd && (!process.env.SENTRY_DSN || !process.env.NEXT_PUBLIC_SENTRY_DSN)) {
  logger.error(
    "[env] Sentry DSN missing (SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN) — error & trace capture is DISABLED in production",
  );
}
