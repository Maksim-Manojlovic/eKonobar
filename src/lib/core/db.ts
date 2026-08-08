import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { _prisma: PrismaClient };

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL!;
  if (url.includes("connection_limit")) return url;
  const sep = url.includes("?") ? "&" : "?";
  const limit = process.env.DATABASE_POOL_SIZE ?? "3";
  return `${url}${sep}connection_limit=${limit}&pool_timeout=10`;
}

const prismaRaw =
  globalForPrisma._prisma ??
  new PrismaClient({ datasources: { db: { url: buildDatabaseUrl() } } });

// Cache on globalThis in all envs — module cache persists across warm serverless
// invocations and across HMR cycles in dev, avoiding connection exhaustion in both.
globalForPrisma._prisma = prismaRaw;

// Direktan pristup bez filtera — za admin operacije i sync-scores cron jobove
export const dbRaw = prismaRaw;

/**
 * Soft-delete filter — injects `deletedAt: null` into every READ on the three
 * soft-deleted models (User, Venue, JobPost).
 *
 * This must cover EVERY read operation, not just the obvious three. The filter
 * previously intercepted only findMany/findFirst/findUnique, so `count`,
 * `aggregate`, `groupBy` and the `*OrThrow` variants silently returned deleted
 * rows — while CLAUDE.md documented an absolute guarantee that `db` never does.
 * A miss here is invisible: no type error, no exception, just deleted people
 * appearing in a total. Add any new read operation to SOFT_DELETE_READ_OPS.
 *
 * Writes are deliberately NOT filtered — restoring a soft-deleted row means
 * updating it by id, which must still reach the row.
 *
 * Kept as an explicit model map rather than a generated one: building it with
 * Object.fromEntries erases the extension's types and degrades `db` for every
 * one of its callers.
 */
type WhereArgs = { where?: Record<string, unknown> };

/** Exported for unit tests — the extension itself needs a live DB to exercise. */
export function excludeDeleted<A extends WhereArgs, R>(
  { args, query }: { args: A; query: (a: A) => R },
): R {
  // `count()` and `aggregate()` are callable with no argument at all.
  const next = (args ?? {}) as A;
  next.where = { deletedAt: null, ...next.where };
  return query(next);
}

/** Every Prisma read operation. A name missing here is a silent filter bypass. */
export const SOFT_DELETE_READ_OPS = [
  "findMany",
  "findFirst",
  "findUnique",
  "findFirstOrThrow",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
] as const;

/** Models carrying a `deletedAt` column. */
export const SOFT_DELETE_MODELS = ["user", "venue", "jobPost"] as const;

const softDeleteReads = Object.fromEntries(
  SOFT_DELETE_READ_OPS.map((op) => [op, excludeDeleted]),
) as Record<(typeof SOFT_DELETE_READ_OPS)[number], typeof excludeDeleted>;

// Klijent sa soft-delete filterom: automatski isključuje User, Venue, JobPost
// zapise gde je deletedAt != null
export const db = prismaRaw.$extends({
  query: {
    user:    softDeleteReads,
    venue:   softDeleteReads,
    jobPost: softDeleteReads,
  },
});
