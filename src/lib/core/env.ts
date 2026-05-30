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
      console.warn(`[env] WARNING: ${name} is not set — related feature will be disabled`);
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
