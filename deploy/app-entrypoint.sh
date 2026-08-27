#!/bin/sh
# Container entrypoint: apply pending migrations, then start the standalone server.
set -e

echo "[entrypoint] prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting server..."
# Monorepo standalone output keeps the workspace layout, so the server entrypoint
# is apps/web/server.js. Prisma above still runs from /app, where ./prisma lives.
exec node apps/web/server.js
