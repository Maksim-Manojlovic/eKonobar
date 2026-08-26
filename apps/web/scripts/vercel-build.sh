#!/usr/bin/env bash
# Vercel build entrypoint. Runs migrate deploy ONLY on production (main) deploys —
# preview/branch deploys generate the client and build, but never touch the shared
# Supabase database. Vercel sets VERCEL_ENV to production | preview | development.
set -euo pipefail

prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "[vercel-build] VERCEL_ENV=production → prisma migrate deploy"
  prisma migrate deploy
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-unset} → skipping migrate deploy"
fi

next build
