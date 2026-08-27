#!/usr/bin/env bash
# Vercel build entrypoint. Runs migrate deploy ONLY on production (main) deploys —
# preview/branch deploys generate the client and build, but never touch the shared
# Supabase database. Vercel sets VERCEL_ENV to production | preview | development.
set -euo pipefail

# The schema lives at the monorepo root, but Vercel's Root Directory is apps/web,
# so this script runs with cwd=apps/web and Prisma's default lookup
# (./prisma/schema.prisma) misses it. Passing --schema explicitly is clearer than
# a prisma.schema field in package.json, which Prisma 6 is moving away from.
SCHEMA="../../prisma/schema.prisma"

prisma generate --schema="$SCHEMA"

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "[vercel-build] VERCEL_ENV=production → prisma migrate deploy"
  prisma migrate deploy --schema="$SCHEMA"
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-unset} → skipping migrate deploy"
fi

next build
