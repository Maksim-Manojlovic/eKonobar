#!/usr/bin/env node
/**
 * Observability guard — static invariants for the telemetry layer (TEL-A..E, CQ-M).
 *
 * These wirings have regressed silently before (CSP worker-src dropped 'self' → push
 * dead; error boundaries fell back to console.error → crashes unreported). This script
 * fails CI the moment one of them is removed, so the "what broke / who did what / context
 * chain" guarantees can't rot. No Sentry credentials or network needed — pure file checks.
 *
 * Run: `node scripts/check-observability.mjs` (also wired as the `observability` CI job).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const failures = [];
const check = (label, cond) => {
  if (!cond) failures.push(label);
};

// ── TEL-A: error boundaries report to Sentry, never swallow to console ──────
const BOUNDARIES = [
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/(dashboard)/error.tsx",
  "src/app/(public)/error.tsx",
];
for (const f of BOUNDARIES) {
  check(`${f} exists`, existsSync(join(ROOT, f)));
  if (!existsSync(join(ROOT, f))) continue;
  const src = read(f);
  check(`${f} calls Sentry.captureException`, /Sentry\.captureException\(/.test(src));
  check(`${f} does not console.error/log the error`, !/console\.(error|log)\s*\(/.test(src));
}
// global-error owns html/body (root-layout boundary); plain error.tsx must NOT
check(
  "global-error.tsx renders <html>/<body>",
  /<html/.test(read("src/app/global-error.tsx")),
);
check(
  "root error.tsx does NOT render <html> (that's global-error's job)",
  !/<html/.test(read("src/app/error.tsx")),
);

// ── Sentry init surface ─────────────────────────────────────────────────────
for (const f of [
  "instrumentation.ts",
  "sentry.client.config.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
]) {
  check(`${f} exists`, existsSync(join(ROOT, f)));
}
// TEL-D: DB spans
check(
  "sentry.server.config.ts wires prismaIntegration",
  /prismaIntegration\(/.test(read("sentry.server.config.ts")),
);

// ── TEL-B: correlation id originates in middleware ──────────────────────────
const mw = read("src/middleware.ts");
check("middleware stamps x-request-id", /x-request-id/.test(mw));
check("middleware honours upstream x-request-id (no blind overwrite)", /headers\.get\(["']x-request-id["']\)/.test(mw));

// ── TEL-B/C: context plumbing ───────────────────────────────────────────────
check("request-context module exists", existsSync(join(ROOT, "src/lib/core/request-context.ts")));
check(
  "logger.ts binds request context via mixin",
  /mixin\s*\(/.test(read("src/lib/core/logger.ts")) &&
    /request-context/.test(read("src/lib/core/logger.ts")),
);
const withRole = read("src/lib/auth/with-role.ts");
check("with-role opens a request-context scope", /runWithRequestContext|runScoped/.test(withRole));

// ── CQ-M: CSP must not strand the service worker / Sentry ingest ────────────
const cfg = read("next.config.ts");
check("CSP worker-src includes 'self' (CQ-M)", /worker-src[^;]*'self'/.test(cfg));
check("CSP connect-src allows Sentry ingest", /ingest\.sentry\.io/.test(cfg));

// ── TEL-E: prod DSN boot guard ──────────────────────────────────────────────
const env = read("src/lib/core/env.ts");
check("env.ts guards missing Sentry DSN in prod", /SENTRY_DSN/.test(env) && /isProd/.test(env));

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error("✖ Observability guard FAILED — telemetry invariant(s) broken:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n${failures.length} check(s) failed. See scripts/check-observability.mjs.`);
  process.exit(1);
}
console.log("✓ Observability guard passed — all telemetry invariants intact.");
