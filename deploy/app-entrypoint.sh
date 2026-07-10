#!/bin/sh
# Container entrypoint: apply pending migrations, then start the standalone server.
set -e

echo "[entrypoint] prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting server..."
exec node server.js
