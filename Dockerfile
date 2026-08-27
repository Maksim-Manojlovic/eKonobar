# syntax=docker/dockerfile:1
# Production image — multi-stage, Next.js standalone output, npm workspaces monorepo.
# Build args: NEXT_PUBLIC_* values are baked into the client bundle at build time.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────
# `npm ci` validates the lockfile against every workspace, so each workspace's
# package.json has to be present before install — copying only the root one fails.
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-client/package.json ./packages/api-client/
COPY prisma ./prisma
RUN npm ci

# ── builder ───────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_VAPID_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_VAPID_KEY=$NEXT_PUBLIC_VAPID_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1

# Schema stays at the monorepo root; the generated client lands in the hoisted
# root node_modules, which is where apps/web resolves @prisma/client from.
RUN npx prisma generate

# Build the web workspace directly rather than through `turbo run build` — one
# fewer moving part in the image, and npm sets the cwd to apps/web, which
# next.config.ts relies on to locate the monorepo root.
#
# DATABASE_URL and NEXTAUTH_SECRET are placeholders needed only to get through the
# build: `next build` collects page data by importing every route module, which runs
# the required() checks in src/lib/core/env.ts, and .dockerignore (correctly) keeps
# .env out of the build context. Nothing connects to that URL — Prisma only reads
# the schema. They are set inline on this RUN rather than as ENV so they never land
# in the image's environment metadata; the real values arrive from env_file at
# container start. Neither is a NEXT_PUBLIC_ var, so neither reaches the client bundle.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXTAUTH_SECRET=build-time-placeholder \
    npm run build --workspace @ekonobar/web

# Stage the Prisma CLI's real dependency closure for the runner. See the script
# header — copying node_modules/prisma + @prisma alone leaves the CLI unable to
# resolve `effect`, and the container dies before the server ever starts.
RUN node deploy/collect-prisma-runtime.mjs /app/node_modules /prisma-runtime/node_modules

# ── runner ────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

# outputFileTracingRoot is the monorepo root, so the standalone tree mirrors the
# workspace layout: ./node_modules + ./apps/web/server.js. Unpacking it at /app
# therefore puts the entrypoint at /app/apps/web/server.js, not /app/server.js.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Prisma CLI (full dependency closure, staged in the builder) + schema, so the
# entrypoint can run `migrate deploy`. Merges on top of the standalone bundle's
# traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /prisma-runtime/node_modules ./node_modules
# The generated client is emitted, not depended on, so the closure walk misses it.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

COPY --chown=nextjs:nodejs deploy/app-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
