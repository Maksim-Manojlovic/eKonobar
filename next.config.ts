import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
