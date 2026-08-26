import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { withSentryConfig } from "@sentry/nextjs";

// Monorepo root — one directory above apps/. Used for two things below.
const MONOREPO_ROOT = path.join(process.cwd(), "..", "..");

// The single .env lives at the monorepo root so Prisma (schema is at the root)
// and Next.js (running from apps/web) read the same file. Next only looks in its
// own directory, so load the root file explicitly before the config object is
// evaluated — `experimental.serverActions.allowedOrigins` below reads from it.
//
// forceReload (4th arg) is mandatory, not defensive: Next calls loadEnvConfig for
// apps/web *before* it loads this file, finds no .env there, and caches that empty
// result. Without forceReload this call is a silent no-op and the build dies in the
// page-data workers with "Missing required environment variable: DATABASE_URL".
loadEnvConfig(MONOREPO_ROOT, process.env.NODE_ENV === "development", undefined, true);

const CSP = [
  "default-src 'self'",
  // Next.js RSC hydration requires unsafe-inline; Mapbox GL requires unsafe-eval for shaders
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: *.mapbox.com *.cloudinary.com",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com wss://*.mapbox.com https://*.ingest.sentry.io",
  // Mapbox GL spawns Web Workers via blob URLs; 'self' allows the web-push service worker (/sw.js)
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  {
    key:   "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker deploys (node server.js, no next CLI)
  output: "standalone",
  // In a workspace, dependencies are hoisted to the monorepo root, so file
  // tracing must start there — otherwise the standalone bundle ships without
  // node_modules and the container exits on the first require().
  // The emitted entrypoint is apps/web/server.js, not server.js.
  outputFileTracingRoot: MONOREPO_ROOT,
  // Workspace packages are shipped as TypeScript source (no build step), so
  // Next has to compile them itself.
  transpilePackages: ["@ekonobar/shared", "@ekonobar/api-client"],
  serverExternalPackages: ["cloudinary", "pino", "thread-stream", "sonic-boom", "pino-pretty"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mapbox.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ?? "localhost:3000",
      ],
    },
  },
};

export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps only in CI to avoid slowing local builds
  silent:          !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: {
    // Migrated from the deprecated top-level disableLogger / automaticVercelMonitors flags.
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
