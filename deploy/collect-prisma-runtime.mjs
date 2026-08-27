#!/usr/bin/env node
/**
 * Collect the Prisma CLI's full dependency closure into a staging directory, so the
 * production image can run `prisma migrate deploy` without shipping all of node_modules.
 *
 * Why this exists: the runner stage used to copy exactly three paths —
 * node_modules/prisma, node_modules/@prisma and node_modules/.prisma. That is not the
 * CLI's real closure. Prisma 6.19's `@prisma/config` depends on `effect`, `c12`, `jiti`
 * and friends, none of which live under those prefixes, so the container died on its
 * first line with `Cannot find module 'effect'`. Hand-listing the extras would just
 * rot at the next Prisma upgrade — walking the dependency graph does not.
 *
 * Usage: node deploy/collect-prisma-runtime.mjs <sourceNodeModules> <destNodeModules>
 */
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [, , SRC, DEST] = process.argv;

if (!SRC || !DEST) {
  console.error("usage: collect-prisma-runtime.mjs <sourceNodeModules> <destNodeModules>");
  process.exit(1);
}

/** Package names already visited — also the final copy list. */
const seen = new Set();

function walk(name) {
  if (seen.has(name)) return;

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(SRC, name, "package.json"), "utf8"));
  } catch {
    // Optional peer or a package hoisted elsewhere. Nothing to copy; the CLI either
    // does not need it on this platform or resolves it from the standalone bundle.
    return;
  }

  seen.add(name);
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep);
}

walk("prisma");

if (seen.size === 0) {
  console.error(`[collect-prisma-runtime] found no 'prisma' package under ${SRC}`);
  process.exit(1);
}

for (const name of seen) {
  const to = join(DEST, name);
  mkdirSync(dirname(to), { recursive: true }); // scoped names need the @scope dir first
  cpSync(join(SRC, name), to, { recursive: true, dereference: true });
}

console.log(`[collect-prisma-runtime] copied ${seen.size} packages to ${DEST}`);
